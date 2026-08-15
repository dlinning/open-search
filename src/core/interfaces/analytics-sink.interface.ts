import { AnalyticsEventDto } from "@typing/analytics.types";

export interface IAnalyticsSink {
	readonly sinkId: string;

	/**
	 * Dispatches a single analytics event.
	 */
	send(event: AnalyticsEventDto): Promise<void>;

	/**
	 * Dispatches a batch of analytics events (optional optimization).
	 */
	sendBatch?(events: readonly AnalyticsEventDto[]): Promise<void>;

	/**
	 * Performs sink health check or ping.
	 */
	healthCheck?(): Promise<boolean>;
}
