import { SearchProviderId } from "@typing/provider.types";

export type FilterOperator =
	"EQ" | "NEQ" | "IN" | "NIN" | "GT" | "GTE" | "LT" | "LTE" | "BETWEEN" | "CONTAINS" | "PREFIX";

export interface LeafFilter {
	readonly type: "leaf";
	readonly field: string;
	readonly operator: FilterOperator;
	readonly value: string | number | boolean | readonly (string | number)[];
}

export interface CompositeFilter {
	readonly type: "composite";
	readonly logic: "AND" | "OR" | "NOT";
	readonly filters: readonly SearchFilterNode[];
}

export type SearchFilterNode = LeafFilter | CompositeFilter;

export interface SortClause {
	readonly field: string;
	readonly direction: "asc" | "desc";
}

export interface PaginationParams {
	readonly page: number;
	readonly pageSize: number;
	readonly cursor?: string;
}

export interface UserGeoLocation {
	readonly country?: string;
	readonly region?: string;
	readonly city?: string;
	readonly latitude?: number;
	readonly longitude?: number;
}

export interface UserContext {
	readonly userId?: string;
	readonly sessionId: string;
	readonly userAgent?: string;
	readonly locale?: string;
	readonly currency?: string;
	readonly geo?: UserGeoLocation;
	readonly segments?: readonly string[];
	readonly customAttributes?: Readonly<Record<string, unknown>>;
}

export interface CategoryBoost {
	readonly category: string;
	readonly weight: number;
}

export interface BrandBoost {
	readonly brand: string;
	readonly weight: number;
}

export interface QueryBoostParameters {
	readonly categoryBoosts?: readonly CategoryBoost[];
	readonly brandBoosts?: readonly BrandBoost[];
	readonly priceRangeBoost?: {
		readonly min?: number;
		readonly max?: number;
	};
}

export interface SearchRequestDto {
	readonly query: string;
	readonly providerId?: SearchProviderId;
	readonly pagination: PaginationParams;
	readonly filters?: SearchFilterNode;
	readonly facetsRequested?: readonly string[];
	readonly sort?: readonly SortClause[];
	readonly userContext: UserContext;
	readonly enablePersonalization?: boolean;
	readonly debug?: boolean;
}
