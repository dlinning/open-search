import { SearchProviderId } from "@typing/provider.types";
import { SearchFilterNode } from "@typing/search-request.types";

export interface PriceDto {
	readonly currency: string;
	readonly regularPrice: number;
	readonly salePrice?: number;
	readonly discountPercentage?: number;
}

export interface RatingDto {
	readonly average: number;
	readonly count: number;
}

export interface ProductHit {
	readonly id: string;
	readonly sku: string;
	readonly title: string;
	readonly description: string;
	readonly brand?: string;
	readonly categories: readonly string[];
	readonly hierarchicalCategories?: Readonly<Record<string, readonly string[]>>;
	readonly price: PriceDto;
	readonly thumbnailUrl?: string;
	readonly images?: readonly string[];
	readonly inStock: boolean;
	readonly inventoryCount?: number;
	readonly rating?: RatingDto;
	readonly attributes: Readonly<Record<string, unknown>>;
	readonly relevanceScore?: number;
	readonly highlightedFields?: Readonly<Record<string, string>>;
}

export interface FacetBucket {
	readonly value: string;
	readonly count: number;
	readonly selected?: boolean;
}

export interface FacetResult {
	readonly field: string;
	readonly displayName: string;
	readonly type: "terms" | "range" | "hierarchical";
	readonly buckets: readonly FacetBucket[];
}

export interface SearchTelemetry {
	readonly executionTimeMs: number;
	readonly providerExecutionTimeMs: number;
	readonly sessionAffinityLookupMs: number;
	readonly provider: SearchProviderId;
	readonly fallbackTriggered: boolean;
	readonly cachedResponse: boolean;
}

export interface ActiveExperimentTag {
	readonly experimentId: string;
	readonly variantId: string;
	readonly scope: string;
}

export interface SearchResponseDto {
	readonly searchId: string;
	readonly query: string;
	readonly pagination: {
		readonly page: number;
		readonly pageSize: number;
		readonly totalHits: number;
		readonly totalPages: number;
		readonly nextCursor?: string;
	};
	readonly items: readonly ProductHit[];
	readonly facets: readonly FacetResult[];
	readonly appliedFilters?: SearchFilterNode;
	readonly activeExperiments: readonly ActiveExperimentTag[];
	readonly suggestions?: readonly string[];
	readonly telemetry: SearchTelemetry;
}
