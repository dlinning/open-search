import { AnalyticsEventType } from "@typing/analytics.types";
import { SearchProviderId } from "@typing/provider.types";
import { z } from "zod";

export const trackEventSchema = z.object({
	eventId: z.string().uuid().optional(),
	eventType: z.nativeEnum(AnalyticsEventType),
	searchId: z.string().min(1),
	provider: z.nativeEnum(SearchProviderId).default(SearchProviderId.MOCK),
	experiments: z
		.array(
			z.object({
				experimentId: z.string(),
				variantId: z.string(),
			})
		)
		.default([]),
	payload: z
		.object({
			query: z.string().optional(),
			totalHits: z.number().int().nonnegative().optional(),
			returnedItemIds: z.array(z.string()).optional(),
			clickedItemId: z.string().optional(),
			rankPosition: z.number().int().positive().optional(),
			pricePaid: z.number().positive().optional(),
			currency: z.string().optional(),
			latencyMs: z.number().nonnegative().optional(),
			customMetadata: z.record(z.unknown()).optional(),
		})
		.default({}),
});

export type TrackEventInput = z.infer<typeof trackEventSchema>;
