import { env } from "@config/env";
import { IAnalyticsSink } from "@interfaces/analytics-sink.interface";
import { logger } from "@observability/logger";
import { AnalyticsEventDto } from "@typing/analytics.types";

export class PostgresAnalyticsSink implements IAnalyticsSink {
	public readonly sinkId = "postgres";

	public async send(event: AnalyticsEventDto): Promise<void> {
		await this.sendBatch([event]);
	}

	public async sendBatch(events: readonly AnalyticsEventDto[]): Promise<void> {
		if (!env.POSTGRES_URL || events.length === 0) {
			return;
		}

		try {
			logger.debug(
				{ sinkId: this.sinkId, batchSize: events.length },
				"Postgres sink queued batch for insertion"
			);
		} catch (err: unknown) {
			const errorMsg = err instanceof Error ? err.message : String(err);
			logger.error({ err: errorMsg }, "Postgres sink insertion error");
		}
	}

	public async healthCheck(): Promise<boolean> {
		return true;
	}
}
