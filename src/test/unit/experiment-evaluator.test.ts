import { ExperimentDefinition } from "@domain-types/experiment.types";
import { SearchRequestDto } from "@domain-types/search-request.types";
import { ExperimentEvaluator } from "@experiments/experiment-evaluator";
import { describe, expect, it } from "vitest";

describe("ExperimentEvaluator Unit Tests", () => {
	const baseRequest: SearchRequestDto = {
		query: "running shoes",
		pagination: { page: 1, pageSize: 20 },
		userContext: {
			sessionId: "sess_fixed_user_1",
			locale: "en-US",
			currency: "USD",
		},
	};

	it("should deterministically assign user to the same variant every time", () => {
		const evaluator = new ExperimentEvaluator();

		const experiment: ExperimentDefinition = {
			id: "test_exp_1",
			scope: "RANKING_BOOST",
			enabled: true,
			trafficPercentage: 100,
			variants: [
				{ variantId: "control", weight: 50 },
				{ variantId: "variant_b", weight: 50 },
			],
			mutate: (req: SearchRequestDto) => req,
		};

		evaluator.register(experiment);

		const run1 = evaluator.evaluate(baseRequest);
		const run2 = evaluator.evaluate(baseRequest);

		expect(run1.assignments).toHaveLength(1);
		expect(run1.assignments[0]?.variantId).toBe(run2.assignments[0]?.variantId);
		expect(run1.assignments[0]?.experimentId).toBe("test_exp_1");
	});

	it("should enforce that variant weights sum to 100%", () => {
		const evaluator = new ExperimentEvaluator();

		const invalidExp: ExperimentDefinition = {
			id: "invalid_exp",
			scope: "PROVIDER",
			enabled: true,
			trafficPercentage: 100,
			variants: [
				{ variantId: "control", weight: 30 },
				{ variantId: "variant_b", weight: 30 },
			],
			mutate: (req: SearchRequestDto) => req,
		};

		expect(() => evaluator.register(invalidExp)).toThrowError(/must sum to 100%/);
	});
});
