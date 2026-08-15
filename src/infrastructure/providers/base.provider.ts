import { AppError } from "@errors/app-error";
import { ISearchProvider } from "@interfaces/search-provider.interface";
import { logger } from "@observability/logger";
import { ProviderCapability, SearchProviderId } from "@typing/provider.types";
import { QueryBoostParameters, SearchRequestDto } from "@typing/search-request.types";
import { SearchResponseDto } from "@typing/search-response.types";
import CircuitBreaker from "opossum";

export abstract class BaseSearchProvider<TRawReq, TRawRes> implements ISearchProvider<
	TRawReq,
	TRawRes
> {
	public abstract readonly providerId: SearchProviderId;
	public abstract readonly capabilities: ReadonlySet<ProviderCapability>;

	protected readonly breaker: CircuitBreaker<[TRawReq, AbortSignal], TRawRes>;
	protected readonly timeoutMs: number;

	constructor(timeoutMs = 2500, breakerOptions?: CircuitBreaker.Options) {
		this.timeoutMs = timeoutMs;
		this.breaker = new CircuitBreaker(
			(req: TRawReq, signal: AbortSignal) => this.executeVendorSearch(req, signal),
			{
				timeout: this.timeoutMs,
				errorThresholdPercentage: 50,
				resetTimeout: 10000,
				...breakerOptions,
			}
		);

		this.breaker.on("open", () => {
			logger.warn(
				{ providerId: this.providerId },
				`Circuit breaker OPEN for provider '${this.providerId}'`
			);
		});

		this.breaker.on("halfOpen", () => {
			logger.info(
				{ providerId: this.providerId },
				`Circuit breaker HALF-OPEN probing for provider '${this.providerId}'`
			);
		});

		this.breaker.on("close", () => {
			logger.info(
				{ providerId: this.providerId },
				`Circuit breaker CLOSED (recovered) for provider '${this.providerId}'`
			);
		});
	}

	public abstract mapToVendorRequest(
		request: SearchRequestDto,
		boostParams?: QueryBoostParameters
	): TRawReq;

	public abstract executeVendorSearch(rawReq: TRawReq, signal: AbortSignal): Promise<TRawRes>;

	public abstract mapToInternalResponse(
		rawRes: TRawRes,
		originalReq: SearchRequestDto,
		searchId: string,
		durationMs: number
	): SearchResponseDto;

	public async search(
		request: SearchRequestDto,
		searchId: string,
		boostParams?: QueryBoostParameters
	): Promise<SearchResponseDto> {
		const startTime = performance.now();
		const vendorPayload = this.mapToVendorRequest(request, boostParams);

		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), this.timeoutMs);

		try {
			const rawResponse = await this.breaker.fire(vendorPayload, controller.signal);
			const executionTimeMs = Math.round(performance.now() - startTime);
			return this.mapToInternalResponse(rawResponse, request, searchId, executionTimeMs);
		} catch (err: unknown) {
			const executionTimeMs = Math.round(performance.now() - startTime);
			const message = err instanceof Error ? err.message : String(err);

			throw new AppError(
				`Search provider '${this.providerId}' execution failed: ${message}`,
				502,
				"PROVIDER_EXECUTION_ERROR",
				{ providerId: this.providerId, executionTimeMs, error: message }
			);
		} finally {
			clearTimeout(timer);
		}
	}

	public async healthCheck(): Promise<boolean> {
		return !this.breaker.opened;
	}
}
