import { ApiResponseEnvelope } from "@controllers/base.controller";
import { SearchResponseDto } from "@domain-types/search-response.types";
import { initializeContainer } from "@root/bootstrap";
import { createServer } from "@root/server";
import { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

describe("API Smoke Integration Tests", () => {
	let server: FastifyInstance;
	let container: ReturnType<typeof initializeContainer>;

	beforeAll(async () => {
		container = initializeContainer();
		server = createServer(container);
		await server.ready();
	});

	afterAll(async () => {
		await server.close();
		await container.shutdown();
	});

	describe("Health Probes", () => {
		it("GET /health should return 200 and liveness status", async () => {
			const response = await server.inject({
				method: "GET",
				url: "/health",
			});

			expect(response.statusCode).toBe(200);
			const body = JSON.parse(response.payload) as {
				status: string;
				uptime: number;
				timestamp: string;
			};
			expect(body.status).toBe("ok");
			expect(body.uptime).toBeGreaterThanOrEqual(0);
			expect(body.timestamp).toBeDefined();
		});

		it("GET /health/readiness should report readiness of registered providers", async () => {
			const response = await server.inject({
				method: "GET",
				url: "/health/readiness",
			});

			expect(response.statusCode).toBe(200);
			const body = JSON.parse(response.payload) as {
				status: string;
				providers: Record<string, boolean>;
			};
			expect(body.status).toBe("ready");
			expect(body.providers.mock).toBe(true);
			expect(body.providers.example).toBe(true);
		});
	});

	describe("Search Endpoints", () => {
		it("GET /v1/search?q=shoes should execute search and return product hits", async () => {
			const response = await server.inject({
				method: "GET",
				url: "/v1/search?q=shoes",
			});

			expect(response.statusCode).toBe(200);
			expect(response.headers["x-correlation-id"]).toBeDefined();
			expect(response.headers["x-search-id"]).toBeDefined();

			const body = JSON.parse(response.payload) as ApiResponseEnvelope<SearchResponseDto>;
			expect(body.success).toBe(true);
			expect(body.data).toBeDefined();

			const searchData = body.data!;
			expect(searchData.query).toBe("shoes");
			expect(searchData.searchId).toBeDefined();
			expect(searchData.items.length).toBeGreaterThan(0);
			expect(searchData.pagination.page).toBe(1);
			expect(searchData.pagination.pageSize).toBe(20);
			expect(searchData.pagination.totalHits).toBeGreaterThan(0);
			expect(searchData.facets).toBeDefined();
			expect(searchData.telemetry.provider).toBe("mock");
		});

		it("POST /v1/search with AST filters should return filtered items", async () => {
			const response = await server.inject({
				method: "POST",
				url: "/v1/search",
				payload: {
					query: "Nike",
					pagination: { page: 1, pageSize: 5 },
					filters: {
						type: "leaf",
						field: "inStock",
						operator: "EQ",
						value: true,
					},
				},
			});

			expect(response.statusCode).toBe(200);
			const body = JSON.parse(response.payload) as ApiResponseEnvelope<SearchResponseDto>;
			expect(body.success).toBe(true);

			const searchData = body.data!;
			expect(searchData.items.length).toBe(1);
			expect(searchData.items[0]?.brand).toBe("Nike");
			expect(searchData.items[0]?.inStock).toBe(true);
		});

		it("POST /v1/search with invalid pagination should return 400 Validation Error", async () => {
			const response = await server.inject({
				method: "POST",
				url: "/v1/search",
				payload: {
					query: "test",
					pagination: { page: -1, pageSize: 500 },
				},
			});

			expect(response.statusCode).toBe(400);
			const body = JSON.parse(response.payload) as {
				success: boolean;
				error: { code: string; message: string };
			};
			expect(body.success).toBe(false);
			expect(body.error.code).toBe("VALIDATION_ERROR");
		});
	});

	describe("Tracking Endpoint", () => {
		it("POST /v1/track should accept search click events and return 202 Accepted", async () => {
			const response = await server.inject({
				method: "POST",
				url: "/v1/track",
				headers: {
					"x-session-id": "sess_test_123",
				},
				payload: {
					eventType: "search_result_click",
					searchId: "00000000-0000-0000-0000-000000000000",
					payload: {
						clickedItemId: "prod_001",
						rankPosition: 1,
						customMetadata: {
							category: "Footwear",
							brand: "Nike",
						},
					},
				},
			});

			expect(response.statusCode).toBe(202);
			const body = JSON.parse(response.payload) as ApiResponseEnvelope<{ eventId: string }>;
			expect(body.success).toBe(true);
			expect(body.message).toBe("Event accepted for processing");
			expect(body.data?.eventId).toBeDefined();
		});
	});

	describe("Example Template Endpoint", () => {
		it("POST /v1/example should process example domain payload", async () => {
			const response = await server.inject({
				method: "POST",
				url: "/v1/example",
				payload: {
					name: "TemplateTest",
					limit: 5,
					tags: ["sample", "unit-test"],
				},
			});

			expect(response.statusCode).toBe(200);
			const body = JSON.parse(response.payload) as ApiResponseEnvelope<{
				processed: string;
				tags?: readonly string[];
			}>;
			expect(body.success).toBe(true);
			expect(body.data?.processed).toContain("TemplateTest");
			expect(body.data?.tags).toEqual(["sample", "unit-test"]);
		});
	});
});
