/**
 * ============================================================================
 * EXAMPLE TEMPLATE: example.types.ts (Provider-specific)
 * ============================================================================
 * Declare all vendor SDK request payloads, response bodies, and error structures.
 * ============================================================================
 */

export interface ExampleApiRawRequest {
	readonly search_query: string;
	readonly page_num: number;
	readonly page_size: number;
	readonly boost_categories?: readonly string[];
}

export interface ExampleApiHit {
	readonly doc_id: string;
	readonly product_name: string;
	readonly product_desc: string;
	readonly product_brand?: string;
	readonly category_hierarchy: readonly string[];
	readonly unit_price: number;
	readonly in_inventory: boolean;
}

export interface ExampleApiRawResponse {
	readonly status: "success" | "error";
	readonly hits_count: number;
	readonly documents: readonly ExampleApiHit[];
}
