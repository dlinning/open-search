import { ProviderCapability, SearchProviderId } from "@typing/provider.types";
import { QueryBoostParameters, SearchRequestDto } from "@typing/search-request.types";
import { SearchResponseDto } from "@typing/search-response.types";

export interface ISearchProvider<TRawReq = unknown, TRawRes = unknown> {
	readonly providerId: SearchProviderId;
	readonly capabilities: ReadonlySet<ProviderCapability>;

	/**
	 * Maps internal unified search request into vendor-specific payload.
	 */
	mapToVendorRequest(request: SearchRequestDto, boostParams?: QueryBoostParameters): TRawReq;

	/**
	 * Executes search query against external vendor with timeout/cancellation support.
	 */
	executeVendorSearch(rawReq: TRawReq, signal: AbortSignal): Promise<TRawRes>;

	/**
	 * Normalizes vendor-specific search response into unified SearchResponseDto.
	 */
	mapToInternalResponse(
		rawRes: TRawRes,
		originalReq: SearchRequestDto,
		searchId: string,
		durationMs: number
	): SearchResponseDto;

	/**
	 * Main entry point executing full pipeline with circuit breaker, timeout, and telemetry.
	 */
	search(
		request: SearchRequestDto,
		searchId: string,
		boostParams?: QueryBoostParameters
	): Promise<SearchResponseDto>;

	/**
	 * Provider health check probe.
	 */
	healthCheck(): Promise<boolean>;
}
