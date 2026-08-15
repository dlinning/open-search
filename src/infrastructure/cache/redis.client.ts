import Redis from "ioredis";
import { env } from "@config/env";
import { logger } from "@observability/logger";

export class RedisClientFactory {
	private static instance: Redis | null = null;

	public static getClient(): Redis {
		if (!RedisClientFactory.instance) {
			RedisClientFactory.instance = new Redis(env.REDIS_URL, {
				maxRetriesPerRequest: 1,
				retryStrategy(times) {
					if (times > 3) {
						logger.warn(
							"Redis reconnection retries exhausted; running in degraded cache mode"
						);
						return null;
					}
					return Math.min(times * 100, 2000);
				},
				lazyConnect: true,
			});

			RedisClientFactory.instance.on("connect", () => {
				logger.info("Connected to Redis server successfully");
			});

			RedisClientFactory.instance.on("error", (err: Error) => {
				logger.warn({ err: err.message }, "Redis connection error (degraded mode active)");
			});
		}

		return RedisClientFactory.instance;
	}

	public static async close(): Promise<void> {
		if (RedisClientFactory.instance) {
			try {
				if (
					RedisClientFactory.instance.status === "ready" ||
					RedisClientFactory.instance.status === "connecting"
				) {
					await RedisClientFactory.instance.quit();
				} else {
					RedisClientFactory.instance.disconnect();
				}
			} catch {
				RedisClientFactory.instance.disconnect();
			} finally {
				RedisClientFactory.instance = null;
			}
		}
	}
}
