/**
 * ============================================================================
 * EXAMPLE TEMPLATE: example.provider.ts
 * ============================================================================
 * Use this file as a reference template when integrating a new third-party
 * search engine backend.
 *
 * Rules:
 * 1. Subclass `BaseSearchProvider<TRawReq, TRawRes>`.
 * 2. Assign unique `providerId` from `SearchProviderId`.
 * 3. Declare supported `capabilities` in a `Set<ProviderCapability>`.
 * 4. Implement `mapToVendorRequest`, `executeVendorSearch`, `mapToInternalResponse`.
 * ============================================================================
 */

import { BaseSearchProvider } from "@providers/base.provider";
import { ExampleMapper } from "@providers/example/example.mapper";
import { ExampleApiRawRequest, ExampleApiRawResponse } from "@providers/example/example.types";
import { ProviderCapability, SearchProviderId } from "@typing/provider.types";
import { QueryBoostParameters, SearchRequestDto } from "@typing/search-request.types";
import { SearchResponseDto } from "@typing/search-response.types";

export class ExampleSearchProvider extends BaseSearchProvider<
	ExampleApiRawRequest,
	ExampleApiRawResponse
> {
	public readonly providerId = SearchProviderId.EXAMPLE;
	public readonly capabilities: ReadonlySet<ProviderCapability> = new Set([
		ProviderCapability.DYNAMIC_BOOSTING,
		ProviderCapability.QUERY_SUGGESTIONS,
	]);

	constructor(timeoutMs = 2500) {
		super(timeoutMs);
	}

	public mapToVendorRequest(
		request: SearchRequestDto,
		boostParams?: QueryBoostParameters
	): ExampleApiRawRequest {
		return ExampleMapper.toVendorRequest(request, boostParams);
	}

	public async executeVendorSearch(
		rawReq: ExampleApiRawRequest,
		_signal: AbortSignal
	): Promise<ExampleApiRawResponse> {
		// In a real provider, call external HTTP/SDK client passing `_signal`:
		return {
			status: "success",
			hits_count: 1,
			documents: [
				{
					doc_id: "example_001",
					product_name: `Example result for: ${rawReq.search_query}`,
					product_desc: "Template provider execution demonstration product hit.",
					category_hierarchy: ["Examples", "Templates"],
					unit_price: 49.99,
					in_inventory: true,
				},
			],
		};
	}

	public mapToInternalResponse(
		rawRes: ExampleApiRawResponse,
		originalReq: SearchRequestDto,
		searchId: string,
		durationMs: number
	): SearchResponseDto {
		return ExampleMapper.toInternalResponse(rawRes, originalReq, searchId, durationMs);
	}
}
