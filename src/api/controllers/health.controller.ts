import { BaseController } from "@controllers/base.controller";
import { ControllerRoutes } from "@interfaces/controller.interface";
import { SearchProviderRegistry } from "@providers/provider.registry";

export class HealthController extends BaseController {
	constructor(private readonly providerRegistry: SearchProviderRegistry) {
		super();
	}

	public readonly routes: ControllerRoutes = {
		healthRoot: {
			method: "GET",
			path: "/health",
			handler: async (_req, reply) => {
				void reply.status(200).send({
					status: "ok",
					uptime: process.uptime(),
					timestamp: new Date().toISOString(),
				});
			},
		},
		readiness: {
			method: "GET",
			path: "/health/readiness",
			handler: async (_req, reply) => {
				const providers = this.providerRegistry.listAvailable();
				const checks: Record<string, boolean> = {};

				const probePromises = providers.map(async (providerId) => {
					try {
						const provider = this.providerRegistry.get(providerId);
						const isHealthy = await provider.healthCheck();
						return { providerId, isHealthy };
					} catch {
						return { providerId, isHealthy: false };
					}
				});

				const results = await Promise.all(probePromises);
				for (const res of results) {
					checks[res.providerId] = res.isHealthy;
				}

				const isHealthy = Object.values(checks).some((status) => status);

				void reply.status(isHealthy ? 200 : 503).send({
					status: isHealthy ? "ready" : "unhealthy",
					providers: checks,
					timestamp: new Date().toISOString(),
				});
			},
		},
	};
}
