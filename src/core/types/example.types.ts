/**
 * ============================================================================
 * EXAMPLE TEMPLATE: example.types.ts
 * ============================================================================
 * Use this file as a reference template when declaring new domain types, DTOs,
 * or vendor payload types.
 *
 * Rules:
 * 1. Always use strict types (never use `any`).
 * 2. Prefer `readonly` properties for immutability.
 * 3. Use discriminated unions or tagged templates where appropriate.
 * ============================================================================
 */

export interface ExampleVendorPayload {
	readonly q: string;
	readonly limit: number;
	readonly offset: number;
	readonly filterQuery?: string;
	readonly sortOrder?: "asc" | "desc";
	readonly extraParams?: Readonly<Record<string, string>>;
}

export interface ExampleVendorItem {
	readonly objectID: string;
	readonly name: string;
	readonly summary: string;
	readonly amount: number;
	readonly isAvailable: boolean;
	readonly tags: readonly string[];
}

export interface ExampleVendorResponse {
	readonly results: readonly ExampleVendorItem[];
	readonly total: number;
	readonly processingTimeMs: number;
}
