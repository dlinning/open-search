import { AnalyticsDispatcher } from "@analytics/analytics-dispatcher";
import { logger } from "@observability/logger";
import { PersonalizationService } from "@services/personalization.service";
import { AnalyticsEventDto, AnalyticsEventType } from "@typing/analytics.types";

export class TrackingService {
	constructor(
		private readonly analyticsDispatcher: AnalyticsDispatcher,
		private readonly personalizationService: PersonalizationService
	) {}

	public async trackEvent(event: AnalyticsEventDto): Promise<void> {
		// 1. Dispatch event to analytical warehouses
		this.analyticsDispatcher.dispatch(event);

		// 2. Real-time personalization feedback loop: update user/session affinities
		if (
			event.eventType === AnalyticsEventType.SEARCH_RESULT_CLICK ||
			event.eventType === AnalyticsEventType.PRODUCT_DETAIL_VIEW ||
			event.eventType === AnalyticsEventType.CART_ADDITION
		) {
			const category =
				typeof event.payload.customMetadata?.category === "string"
					? event.payload.customMetadata.category
					: undefined;
			const brand =
				typeof event.payload.customMetadata?.brand === "string"
					? event.payload.customMetadata.brand
					: undefined;

			const weight = event.eventType === AnalyticsEventType.CART_ADDITION ? 3 : 1;

			if (category || brand) {
				await this.personalizationService.recordInteraction(event.userContext.sessionId, {
					category,
					brand,
					weight,
				});
			}
		}

		logger.debug(
			{
				eventType: event.eventType,
				searchId: event.searchId,
				sessionId: event.userContext.sessionId,
			},
			"Processed tracking event"
		);
	}
}
