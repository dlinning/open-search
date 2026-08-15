/**
 * ============================================================================
 * EXAMPLE TEMPLATE: example.sink.ts
 * ============================================================================
 * Use this file as a reference template when adding new analytics sinks
 * (e.g. BigQuery, Snowflake, Datadog, Mixpanel).
 *
 * Rules:
 * 1. Implement `IAnalyticsSink`.
 * 2. Never throw unhandled exceptions in `send` or `sendBatch` that could crash
 *    the main event loop.
 * 3. Batch events where the vendor API supports multi-event ingestion.
 * ============================================================================
 */

import { IAnalyticsSink } from "@interfaces/analytics-sink.interface";
import { logger } from "@observability/logger";
import { AnalyticsEventDto } from "@typing/analytics.types";

export class ExampleAnalyticsSink implements IAnalyticsSink {
	public readonly sinkId = "example-sink";

	public async send(event: AnalyticsEventDto): Promise<void> {
		logger.debug(
			{ sinkId: this.sinkId, eventType: event.eventType, searchId: event.searchId },
			"ExampleAnalyticsSink processed single event"
		);
	}

	public async sendBatch(events: readonly AnalyticsEventDto[]): Promise<void> {
		logger.debug(
			{ sinkId: this.sinkId, count: events.length },
			"ExampleAnalyticsSink flushed event batch"
		);
	}

	public async healthCheck(): Promise<boolean> {
		return true;
	}
}
