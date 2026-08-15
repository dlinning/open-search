import { env } from "@config/env";
import {
	IPersonalizationStore,
	UserAffinityUpdate,
} from "@interfaces/personalization-store.interface";
import { logger } from "@observability/logger";
import {
	BrandBoost,
	CategoryBoost,
	QueryBoostParameters,
	UserContext,
} from "@typing/search-request.types";
import { Redis } from "ioredis";

export class PersonalizationService implements IPersonalizationStore {
	constructor(private readonly redis: Redis) {}

	public async getSessionBoosts(
		userContext: UserContext
	): Promise<QueryBoostParameters | undefined> {
		const sessionKey = `${env.REDIS_SESSION_PREFIX}${userContext.sessionId}:affinity`;

		try {
			const affinities = await this.redis.hgetall(sessionKey);
			if (!affinities || Object.keys(affinities).length === 0) {
				return undefined;
			}

			const categoryBoosts: CategoryBoost[] = [];
			const brandBoosts: BrandBoost[] = [];

			for (const [key, valStr] of Object.entries(affinities)) {
				const score = parseFloat(valStr);
				if (Number.isNaN(score) || score <= 0) continue;

				if (key.startsWith("cat:")) {
					categoryBoosts.push({
						category: key.replace("cat:", ""),
						weight: Math.min(score, 10),
					});
				} else if (key.startsWith("brand:")) {
					brandBoosts.push({
						brand: key.replace("brand:", ""),
						weight: Math.min(score, 10),
					});
				}
			}

			return {
				categoryBoosts: categoryBoosts.sort((a, b) => b.weight - a.weight).slice(0, 3),
				brandBoosts: brandBoosts.sort((a, b) => b.weight - a.weight).slice(0, 3),
			};
		} catch (err: unknown) {
			const errorMsg = err instanceof Error ? err.message : String(err);
			logger.debug(
				{ err: errorMsg },
				"Session affinity lookup skipped (Redis offline or timed out)"
			);
			return undefined;
		}
	}

	public async recordInteraction(sessionId: string, update: UserAffinityUpdate): Promise<void> {
		const sessionKey = `${env.REDIS_SESSION_PREFIX}${sessionId}:affinity`;
		const weight = update.weight || 1;

		try {
			const pipeline = this.redis.pipeline();
			if (update.category) {
				pipeline.hincrbyfloat(sessionKey, `cat:${update.category}`, weight);
			}
			if (update.brand) {
				pipeline.hincrbyfloat(sessionKey, `brand:${update.brand}`, weight);
			}
			pipeline.expire(sessionKey, env.REDIS_SESSION_TTL_SECONDS);
			await pipeline.exec();
		} catch (err: unknown) {
			const errorMsg = err instanceof Error ? err.message : String(err);
			logger.debug({ err: errorMsg }, "Could not persist real-time affinity update");
		}
	}
}
