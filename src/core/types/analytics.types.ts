import { SearchProviderId } from "@typing/provider.types";
import { UserContext } from "@typing/search-request.types";

export enum AnalyticsEventType {
	SEARCH_REQUEST = "search_request",
	SEARCH_RESULT_CLICK = "search_result_click",
	PRODUCT_DETAIL_VIEW = "product_detail_view",
	CART_ADDITION = "cart_addition",
	CONVERSION = "conversion",
}

export interface AnalyticsExperimentTag {
	readonly experimentId: string;
	readonly variantId: string;
}

export interface AnalyticsPayload {
	readonly query?: string;
	readonly totalHits?: number;
	readonly returnedItemIds?: readonly string[];
	readonly clickedItemId?: string;
	readonly rankPosition?: number;
	readonly pricePaid?: number;
	readonly currency?: string;
	readonly latencyMs?: number;
	readonly customMetadata?: Readonly<Record<string, unknown>>;
}

export interface AnalyticsEventDto {
	readonly eventId: string;
	readonly eventType: AnalyticsEventType;
	readonly timestamp: string; // ISO 8601 UTC
	readonly searchId: string; // Trace token connecting search to downstream clicks/conversions
	readonly provider: SearchProviderId;
	readonly userContext: UserContext;
	readonly experiments: readonly AnalyticsExperimentTag[];
	readonly payload: AnalyticsPayload;
}
