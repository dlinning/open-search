import { AnalyticsDispatcher } from "@analytics/analytics-dispatcher";
import { ExperimentEvaluator } from "@experiments/experiment-evaluator";
import { logger } from "@observability/logger";
import { SearchProviderRegistry } from "@providers/provider.registry";
import { PersonalizationService } from "@services/personalization.service";
import { AnalyticsEventType } from "@typing/analytics.types";
import { SearchProviderId } from "@typing/provider.types";
import { SearchRequestDto } from "@typing/search-request.types";
import { ActiveExperimentTag, SearchResponseDto } from "@typing/search-response.types";
import { v7 as uuidV7 } from "uuid";

export class SearchService {
	constructor(
		private readonly providerRegistry: SearchProviderRegistry,
		private readonly experimentEvaluator: ExperimentEvaluator,
		private readonly personalizationService: PersonalizationService,
		private readonly analyticsDispatcher: AnalyticsDispatcher
	) {}

	public async executeSearch(
		request: SearchRequestDto,
		explicitSearchId?: string
	): Promise<SearchResponseDto> {
		const overallStartTime = performance.now();
		const searchId = explicitSearchId || uuidV7();

		// 1. Evaluate A/B Experiments
		const { mutatedRequest, assignments } = this.experimentEvaluator.evaluate(request);

		// 2. Fetch Session Affinities / Personalization Boosts (in parallel, non-blocking)
		let affinityLookupMs = 0;
		let boostParams;

		if (mutatedRequest.enablePersonalization !== false) {
			const affinityStart = performance.now();
			boostParams = await this.personalizationService.getSessionBoosts(
				mutatedRequest.userContext
			);
			affinityLookupMs = Math.round(performance.now() - affinityStart);
		}

		// 3. Resolve Primary Search Provider
		const targetProviderId = mutatedRequest.providerId;
		let provider = this.providerRegistry.get(targetProviderId);
		let fallbackTriggered = false;
		let response: SearchResponseDto;

		try {
			response = await provider.search(mutatedRequest, searchId, boostParams);
		} catch (primaryErr: unknown) {
			const errorMsg = primaryErr instanceof Error ? primaryErr.message : String(primaryErr);
			logger.warn(
				{ providerId: provider.providerId, err: errorMsg },
				"Primary search provider failed, attempting fallback provider"
			);

			const fallback = this.providerRegistry.getFallback(provider.providerId);
			if (!fallback) {
				throw primaryErr;
			}

			fallbackTriggered = true;
			provider = fallback;
			response = await provider.search(mutatedRequest, searchId, boostParams);
		}

		const totalDurationMs = Math.round(performance.now() - overallStartTime);

		// 4. Transform Active Experiment Tags for Response
		const activeExperimentTags: readonly ActiveExperimentTag[] = assignments.map((a) => ({
			experimentId: a.experimentId,
			variantId: a.variantId,
			scope: a.scope,
		}));

		const finalResponse: SearchResponseDto = {
			...response,
			searchId,
			activeExperiments: activeExperimentTags,
			telemetry: {
				...response.telemetry,
				executionTimeMs: totalDurationMs,
				sessionAffinityLookupMs: affinityLookupMs,
				provider: provider.providerId as SearchProviderId,
				fallbackTriggered,
			},
		};

		// 5. Asynchronous Non-Blocking Analytics Dispatch
		this.analyticsDispatcher.dispatch({
			eventId: uuidV7(),
			eventType: AnalyticsEventType.SEARCH_REQUEST,
			timestamp: new Date().toISOString(),
			searchId,
			provider: provider.providerId,
			userContext: mutatedRequest.userContext,
			experiments: assignments.map((a) => ({
				experimentId: a.experimentId,
				variantId: a.variantId,
			})),
			payload: {
				query: mutatedRequest.query,
				totalHits: finalResponse.pagination.totalHits,
				returnedItemIds: finalResponse.items.map((i) => i.id),
				latencyMs: totalDurationMs,
			},
		});

		return finalResponse;
	}
}
