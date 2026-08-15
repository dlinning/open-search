import { ExperimentAssignment, ExperimentDefinition } from "@typing/experiment.types";
import { SearchRequestDto } from "@typing/search-request.types";

export interface IExperimentEvaluator {
	/**
	 * Registers an experiment definition into the active experiment engine.
	 */
	register(experiment: ExperimentDefinition): void;

	/**
	 * Deterministically evaluates active experiments against the incoming search request,
	 * mutates the request according to assigned variants, and returns the assigned tags.
	 */
	evaluate(request: SearchRequestDto): {
		readonly mutatedRequest: SearchRequestDto;
		readonly assignments: readonly ExperimentAssignment[];
	};
}
