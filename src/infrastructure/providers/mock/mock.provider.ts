import { BaseSearchProvider } from "@providers/base.provider";
import { MOCK_CATALOG } from "@providers/mock/mock.data";
import { ProviderCapability, SearchProviderId } from "@typing/provider.types";
import {
	LeafFilter,
	QueryBoostParameters,
	SearchFilterNode,
	SearchRequestDto,
} from "@typing/search-request.types";
import { FacetResult, ProductHit, SearchResponseDto } from "@typing/search-response.types";

export interface MockSearchPayload {
	readonly query: string;
	readonly page: number;
	readonly pageSize: number;
	readonly filters?: SearchFilterNode;
	readonly boostParams?: QueryBoostParameters;
	readonly facetsRequested?: readonly string[];
}

export interface MockSearchResponse {
	readonly items: readonly ProductHit[];
	readonly totalHits: number;
	readonly page: number;
	readonly pageSize: number;
	readonly facets: readonly FacetResult[];
}

export class MockSearchProvider extends BaseSearchProvider<MockSearchPayload, MockSearchResponse> {
	public readonly providerId = SearchProviderId.MOCK;
	public readonly capabilities: ReadonlySet<ProviderCapability> = new Set([
		ProviderCapability.DISJUNCTIVE_FACETING,
		ProviderCapability.DYNAMIC_BOOSTING,
		ProviderCapability.QUERY_SUGGESTIONS,
	]);

	constructor(timeoutMs = 1000) {
		super(timeoutMs);
	}

	public mapToVendorRequest(
		request: SearchRequestDto,
		boostParams?: QueryBoostParameters
	): MockSearchPayload {
		return {
			query: request.query,
			page: request.pagination.page,
			pageSize: request.pagination.pageSize,
			filters: request.filters,
			boostParams,
			facetsRequested: request.facetsRequested,
		};
	}

	public async executeVendorSearch(
		rawReq: MockSearchPayload,
		_signal: AbortSignal
	): Promise<MockSearchResponse> {
		const q = rawReq.query.toLowerCase().trim();
		let hits = [...MOCK_CATALOG];

		// 1. Text match filter and score
		if (q) {
			const queryTokens = q.split(/\s+/).filter(Boolean);
			hits = hits
				.filter((p) => {
					const searchableText = [p.title, p.description, p.brand ?? "", ...p.categories]
						.join(" ")
						.toLowerCase();

					return queryTokens.some((token) => {
						const singular = token.endsWith("s") ? token.slice(0, -1) : token;
						return (
							searchableText.includes(token) ||
							(singular.length > 2 && searchableText.includes(singular))
						);
					});
				})
				.map((p) => {
					let score = 1;
					const lowerTitle = p.title.toLowerCase();
					const lowerBrand = (p.brand ?? "").toLowerCase();

					for (const token of queryTokens) {
						const singular = token.endsWith("s") ? token.slice(0, -1) : token;
						if (
							lowerTitle.includes(token) ||
							(singular.length > 2 && lowerTitle.includes(singular))
						) {
							score += 5;
						}
						if (lowerBrand.includes(token)) {
							score += 3;
						}
					}

					// Apply personalization boosts
					if (rawReq.boostParams?.categoryBoosts) {
						for (const b of rawReq.boostParams.categoryBoosts) {
							if (
								p.categories.some(
									(c) => c.toLowerCase() === b.category.toLowerCase()
								)
							) {
								score += b.weight;
							}
						}
					}

					if (rawReq.boostParams?.brandBoosts && p.brand) {
						for (const b of rawReq.boostParams.brandBoosts) {
							if (p.brand.toLowerCase() === b.brand.toLowerCase()) {
								score += b.weight;
							}
						}
					}

					return { ...p, relevanceScore: score };
				})
				.sort((a, b) => (b.relevanceScore ?? 0) - (a.relevanceScore ?? 0));
		}

		// 2. Filter application
		if (rawReq.filters) {
			hits = hits.filter((p) => this.matchFilterNode(p, rawReq.filters!));
		}

		// 3. Facet Aggregations
		const facets: FacetResult[] = [];
		const facetFields = rawReq.facetsRequested ?? ["brand", "categories", "inStock"];

		for (const field of facetFields) {
			const countMap = new Map<string, number>();
			for (const item of hits) {
				if (field === "brand" && item.brand) {
					countMap.set(item.brand, (countMap.get(item.brand) ?? 0) + 1);
				} else if (field === "categories") {
					for (const cat of item.categories) {
						countMap.set(cat, (countMap.get(cat) ?? 0) + 1);
					}
				} else if (field === "inStock") {
					const val = item.inStock ? "true" : "false";
					countMap.set(val, (countMap.get(val) ?? 0) + 1);
				}
			}

			facets.push({
				field,
				displayName: field.charAt(0).toUpperCase() + field.slice(1),
				type: "terms",
				buckets: Array.from(countMap.entries()).map(([value, count]) => ({ value, count })),
			});
		}

		const totalHits = hits.length;
		const startIndex = (rawReq.page - 1) * rawReq.pageSize;
		const paginatedItems = hits.slice(startIndex, startIndex + rawReq.pageSize);

		return {
			items: paginatedItems,
			totalHits,
			page: rawReq.page,
			pageSize: rawReq.pageSize,
			facets,
		};
	}

	public mapToInternalResponse(
		rawRes: MockSearchResponse,
		originalReq: SearchRequestDto,
		searchId: string,
		durationMs: number
	): SearchResponseDto {
		const totalPages = Math.ceil(rawRes.totalHits / rawRes.pageSize) || 1;

		return {
			searchId,
			query: originalReq.query,
			pagination: {
				page: rawRes.page,
				pageSize: rawRes.pageSize,
				totalHits: rawRes.totalHits,
				totalPages,
			},
			items: rawRes.items,
			facets: rawRes.facets,
			appliedFilters: originalReq.filters,
			activeExperiments: [],
			telemetry: {
				executionTimeMs: durationMs,
				providerExecutionTimeMs: durationMs,
				sessionAffinityLookupMs: 0,
				provider: this.providerId,
				fallbackTriggered: false,
				cachedResponse: false,
			},
		};
	}

	private matchFilterNode(item: ProductHit, node: SearchFilterNode): boolean {
		if (node.type === "leaf") {
			return this.matchLeaf(item, node);
		}
		if (node.logic === "AND") {
			return node.filters.every((child) => this.matchFilterNode(item, child));
		}
		if (node.logic === "OR") {
			return node.filters.some((child) => this.matchFilterNode(item, child));
		}
		if (node.logic === "NOT") {
			return !node.filters.some((child) => this.matchFilterNode(item, child));
		}
		return true;
	}

	private matchLeaf(item: ProductHit, leaf: LeafFilter): boolean {
		const fieldVal = this.getFieldValue(item, leaf.field);
		if (fieldVal === undefined || fieldVal === null) return false;

		if (leaf.operator === "EQ") {
			return String(fieldVal).toLowerCase() === String(leaf.value).toLowerCase();
		}
		if (leaf.operator === "IN" && Array.isArray(leaf.value)) {
			return leaf.value.some(
				(v) => String(v).toLowerCase() === String(fieldVal).toLowerCase()
			);
		}
		if (
			leaf.operator === "GTE" &&
			typeof fieldVal === "number" &&
			typeof leaf.value === "number"
		) {
			return fieldVal >= leaf.value;
		}
		if (
			leaf.operator === "LTE" &&
			typeof fieldVal === "number" &&
			typeof leaf.value === "number"
		) {
			return fieldVal <= leaf.value;
		}
		return true;
	}

	private getFieldValue(item: ProductHit, field: string): unknown {
		if (field === "brand") return item.brand;
		if (field === "inStock") return item.inStock;
		if (field === "price" || field === "regularPrice") return item.price.regularPrice;
		return item.attributes[field];
	}
}
