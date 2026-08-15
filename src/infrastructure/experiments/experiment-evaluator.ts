import { IExperimentEvaluator } from "@interfaces/experiment-engine.interface";
import { logger } from "@observability/logger";
import {
	ExperimentAssignment,
	ExperimentDefinition,
	ExperimentScope,
} from "@typing/experiment.types";
import { SearchRequestDto } from "@typing/search-request.types";
import murmur from "murmurhash";

export class ExperimentEvaluator implements IExperimentEvaluator {
	private readonly experiments = new Map<string, ExperimentDefinition>();

	public register(experiment: ExperimentDefinition): void {
		const totalWeight = experiment.variants.reduce((acc, v) => acc + v.weight, 0);
		if (totalWeight !== 100) {
			throw new Error(
				`Experiment '${experiment.id}' variants must sum to 100% (currently ${totalWeight}%)`
			);
		}
		this.experiments.set(experiment.id, experiment);
		logger.info(
			{ experimentId: experiment.id, scope: experiment.scope },
			"Registered experiment"
		);
	}

	public evaluate(request: SearchRequestDto): {
		readonly mutatedRequest: SearchRequestDto;
		readonly assignments: readonly ExperimentAssignment[];
	} {
		const assignments: ExperimentAssignment[] = [];
		let currentRequest = request;
		const entityKey = request.userContext.userId || request.userContext.sessionId;

		// Scopes to evaluate in strict sequence to avoid conflicts
		const scopeSequence: readonly ExperimentScope[] = [
			"PROVIDER",
			"QUERY_REWRITE",
			"RANKING_BOOST",
			"FACET_LAYOUT",
		];

		for (const scope of scopeSequence) {
			for (const exp of this.experiments.values()) {
				if (!exp.enabled || exp.scope !== scope) {
					continue;
				}

				if (exp.targetingRule && !exp.targetingRule(currentRequest)) {
					continue;
				}

				// Traffic allocation check
				const trafficBucket = this.hashToBucket(`${entityKey}:${exp.id}:traffic`, 100);
				if (trafficBucket >= exp.trafficPercentage) {
					continue;
				}

				// Variant selection
				const variantBucket = this.hashToBucket(`${entityKey}:${exp.id}:variant`, 100);
				let cumulative = 0;
				let selectedVariant = exp.variants[0];

				if (!selectedVariant) {
					continue;
				}

				for (const variant of exp.variants) {
					cumulative += variant.weight;
					if (variantBucket < cumulative) {
						selectedVariant = variant;
						break;
					}
				}

				currentRequest = exp.mutate(
					currentRequest,
					selectedVariant.variantId,
					selectedVariant.config
				);
				assignments.push({
					experimentId: exp.id,
					variantId: selectedVariant.variantId,
					scope: exp.scope,
				});
			}
		}

		return {
			mutatedRequest: currentRequest,
			assignments,
		};
	}

	private hashToBucket(key: string, modulus: number): number {
		const hash = murmur.v3(key, 0x12345678);
		return Math.abs(hash) % modulus;
	}
}
