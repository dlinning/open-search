import { SearchRequestDto } from "@domain-types/search-request.types";
import { MockSearchProvider } from "@providers/mock/mock.provider";
import { describe, expect, it } from "vitest";

describe("MockSearchProvider Unit Tests", () => {
	const provider = new MockSearchProvider();

	it("should find products matching query keyword", async () => {
		const request: SearchRequestDto = {
			query: "MacBook",
			pagination: { page: 1, pageSize: 10 },
			userContext: { sessionId: "sess_1", locale: "en-US", currency: "USD" },
		};

		const response = await provider.search(request, "search_id_1");
		expect(response.items.length).toBe(1);
		expect(response.items[0]?.title).toContain("MacBook Pro");
		expect(response.pagination.totalHits).toBe(1);
	});

	it("should apply dynamic category boosts to elevate score", async () => {
		const request: SearchRequestDto = {
			query: "running",
			pagination: { page: 1, pageSize: 10 },
			userContext: { sessionId: "sess_1", locale: "en-US", currency: "USD" },
		};

		const responseWithBoost = await provider.search(request, "search_id_2", {
			categoryBoosts: [{ category: "Footwear", weight: 8 }],
		});

		expect(responseWithBoost.items.length).toBeGreaterThan(0);
		expect(responseWithBoost.items[0]?.categories).toContain("Footwear");
	});

	it("should compute facet aggregations accurately", async () => {
		const request: SearchRequestDto = {
			query: "",
			pagination: { page: 1, pageSize: 20 },
			facetsRequested: ["brand", "categories"],
			userContext: { sessionId: "sess_1", locale: "en-US", currency: "USD" },
		};

		const response = await provider.search(request, "search_id_3");
		expect(response.facets).toHaveLength(2);

		const brandFacet = response.facets.find((f) => f.field === "brand");
		expect(brandFacet).toBeDefined();
		expect(brandFacet?.buckets.length).toBeGreaterThan(0);
	});
});
