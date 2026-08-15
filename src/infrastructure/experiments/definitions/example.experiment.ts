/**
 * ============================================================================
 * EXAMPLE TEMPLATE: example.experiment.ts
 * ============================================================================
 * Use this file as a reference template when defining A/B experiments.
 *
 * Rules:
 * 1. Variant weights must sum to exactly 100.
 * 2. Scopes must be one of: 'PROVIDER', 'QUERY_REWRITE', 'RANKING_BOOST', 'FACET_LAYOUT'.
 * 3. The `mutate` function must be pure and return a new or modified `SearchRequestDto`.
 * ============================================================================
 */

import { ExperimentDefinition } from "@typing/experiment.types";
import { SearchRequestDto } from "@typing/search-request.types";

export const ExampleExperiment: ExperimentDefinition = {
	id: "exp_example_ranking_boost_v1",
	scope: "RANKING_BOOST",
	enabled: true,
	trafficPercentage: 100,
	variants: [
		{ variantId: "control", weight: 50 },
		{
			variantId: "boost_electronics",
			weight: 50,
			config: { category: "Electronics", weight: 2.5 },
		},
	],
	targetingRule: (req: SearchRequestDto) => req.query.length > 2,
	mutate: (req: SearchRequestDto, variantId: string) => {
		if (variantId === "boost_electronics") {
			// In a real mutation, inject or adjust boost rules
			return req;
		}
		return req;
	},
};
