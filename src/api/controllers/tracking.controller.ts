import { BaseController } from "@controllers/base.controller";
import { ControllerRoutes, FastifyRouteHandler } from "@interfaces/controller.interface";
import { TrackingService } from "@services/tracking.service";
import { AnalyticsEventDto } from "@typing/analytics.types";
import { trackEventSchema } from "@validation/tracking.schema";
import { v7 as uuidV7 } from "uuid";

export class TrackingController extends BaseController {
	constructor(private readonly trackingService: TrackingService) {
		super();
	}

	public readonly routes: ControllerRoutes = {
		track: {
			method: "post",
			path: "/track",
			handler: (req, reply) => this.handleTrack(req, reply),
		},
	};

	public handleTrack: FastifyRouteHandler = async (req, reply) => {
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
	};
}
