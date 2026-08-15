import { BaseController } from "@core/controllers/base.controller";
import { ControllerRoutes } from "@interfaces/controller.interface";
import { TrackingService } from "@services/tracking.service";
import { AnalyticsEventDto } from "@typing/analytics.types";
import { trackEventSchema } from "@validation/tracking.schema";
import { v7 as uuidV7 } from "uuid";

export class TrackingController extends BaseController {
	constructor(private readonly trackingService: TrackingService) {
		super({
			urlPrefix: "/track",
		});
	}

	public readonly routes: ControllerRoutes = [
		{
			method: "post",
			path: "/",
			handler: async (req, reply) => {
				const input = trackEventSchema.parse(req.body);

				const event: AnalyticsEventDto = {
					eventId: input.eventId || uuidV7(),
					eventType: input.eventType,
					timestamp: new Date().toISOString(),
					searchId: input.searchId,
					provider: input.provider,
					userContext: this.getUserContext(req),
					experiments: input.experiments,
					payload: input.payload,
				};

				await this.trackingService.trackEvent(event);

				this.accepted(reply, "Event accepted for processing", {
					eventId: event.eventId,
				});
			},
		},
	];
}
