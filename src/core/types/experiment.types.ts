import { SearchRequestDto } from "@typing/search-request.types";

export type ExperimentScope = "PROVIDER" | "QUERY_REWRITE" | "RANKING_BOOST" | "FACET_LAYOUT";

export interface VariantAllocation {
	readonly variantId: string;
	readonly weight: number; // 0 to 100 integer percentage
	readonly config?: Readonly<Record<string, unknown>>;
}

export interface ExperimentDefinition {
	readonly id: string;
	readonly scope: ExperimentScope;
	readonly enabled: boolean;
	readonly trafficPercentage: number; // 0 - 100
	readonly variants: readonly VariantAllocation[];
	readonly targetingRule?: (req: SearchRequestDto) => boolean;
	readonly mutate: (
		req: SearchRequestDto,
		variantId: string,
		config?: Readonly<Record<string, unknown>>
	) => SearchRequestDto;
}

export interface ExperimentAssignment {
	readonly experimentId: string;
	readonly variantId: string;
	readonly scope: ExperimentScope;
}
