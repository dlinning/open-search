/**
 * ============================================================================
 * EXAMPLE TEMPLATE: example.mapper.ts
 * ============================================================================
 * Use this file as a reference template when mapping unified internal SearchRequestDto
 * into vendor payloads, and vendor responses into unified SearchResponseDto.
 *
 * Rules:
 * 1. Implement static pure mapping functions.
 * 2. Handle missing or nullable fields safely without throwing.
 * 3. Never use `any`. Use strict typing with vendor and domain types.
 * ============================================================================
 */

import {
	ExampleApiHit,
	ExampleApiRawRequest,
	ExampleApiRawResponse,
} from "@providers/example/example.types";
import { SearchProviderId } from "@typing/provider.types";
import { QueryBoostParameters, SearchRequestDto } from "@typing/search-request.types";
import { ProductHit, SearchResponseDto } from "@typing/search-response.types";

export class ExampleMapper {
	public static toVendorRequest(
		req: SearchRequestDto,
		boostParams?: QueryBoostParameters
	): ExampleApiRawRequest {
		const boostCategories = boostParams?.categoryBoosts?.map((b) => b.category);

		return {
			search_query: req.query,
			page_num: req.pagination.page,
			page_size: req.pagination.pageSize,
			boost_categories: boostCategories,
		};
	}

	public static toInternalResponse(
		raw: ExampleApiRawResponse,
		originalReq: SearchRequestDto,
		searchId: string,
		durationMs: number
	): SearchResponseDto {
		const totalHits = raw.hits_count;
		const totalPages = Math.ceil(totalHits / originalReq.pagination.pageSize) || 1;

		const items: readonly ProductHit[] = raw.documents.map((doc: ExampleApiHit) => ({
			id: doc.doc_id,
			sku: doc.doc_id,
			title: doc.product_name,
			description: doc.product_desc,
			brand: doc.product_brand,
			categories: doc.category_hierarchy,
			price: {
				currency: originalReq.userContext.currency || "USD",
				regularPrice: doc.unit_price,
			},
			inStock: doc.in_inventory,
			attributes: {},
		}));

		return {
			searchId,
			query: originalReq.query,
			pagination: {
				page: originalReq.pagination.page,
				pageSize: originalReq.pagination.pageSize,
				totalHits,
				totalPages,
			},
			items,
			facets: [],
			appliedFilters: originalReq.filters,
			activeExperiments: [],
			telemetry: {
				executionTimeMs: durationMs,
				providerExecutionTimeMs: durationMs,
				sessionAffinityLookupMs: 0,
				provider: SearchProviderId.EXAMPLE,
				fallbackTriggered: false,
				cachedResponse: false,
			},
		};
	}
}
