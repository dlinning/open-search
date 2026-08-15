import { env } from "@config/env";
import { IAnalyticsSink } from "@interfaces/analytics-sink.interface";
import { logger } from "@observability/logger";
import { AnalyticsEventDto } from "@typing/analytics.types";

export class AnalyticsDispatcher {
	private readonly sinks: IAnalyticsSink[] = [];
	private buffer: AnalyticsEventDto[] = [];
	private flushTimer: NodeJS.Timeout | null = null;
	private readonly maxBufferSize: number;
	private readonly flushIntervalMs: number;

	constructor(
		maxBufferSize = env.ANALYTICS_BATCH_SIZE,
		flushIntervalMs = env.ANALYTICS_FLUSH_INTERVAL_MS
	) {
		this.maxBufferSize = maxBufferSize;
		this.flushIntervalMs = flushIntervalMs;
		this.startPeriodicFlush();
	}

	public registerSink(sink: IAnalyticsSink): this {
		this.sinks.push(sink);
		logger.info({ sinkId: sink.sinkId }, "Registered analytics sink");
		return this;
	}

	public dispatch(event: AnalyticsEventDto): void {
		this.buffer.push(event);
		if (this.buffer.length >= this.maxBufferSize) {
			void this.flush();
		}
	}

	public async flush(): Promise<void> {
		if (this.buffer.length === 0) return;

		const currentBatch = [...this.buffer];
		this.buffer = [];

		const sinkPromises = this.sinks.map(async (sink) => {
			try {
				if (sink.sendBatch) {
					await sink.sendBatch(currentBatch);
				} else {
					await Promise.allSettled(currentBatch.map((e) => sink.send(e)));
				}
			} catch (err: unknown) {
				const errorMsg = err instanceof Error ? err.message : String(err);
				logger.error(
					{ sinkId: sink.sinkId, err: errorMsg },
					"Analytics sink batch flush failed"
				);
			}
		});

		await Promise.allSettled(sinkPromises);
	}

	public async shutdown(): Promise<void> {
		if (this.flushTimer) {
			clearInterval(this.flushTimer);
			this.flushTimer = null;
		}
		await this.flush();
	}

	private startPeriodicFlush(): void {
		this.flushTimer = setInterval(() => {
			void this.flush();
		}, this.flushIntervalMs);
		this.flushTimer.unref();
	}
}
