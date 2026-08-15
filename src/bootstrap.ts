import { AnalyticsDispatcher } from "@analytics/analytics-dispatcher";
import { ExampleAnalyticsSink } from "@analytics/sinks/example.sink";
import { PostgresAnalyticsSink } from "@analytics/sinks/postgres.sink";
import { RedisClientFactory } from "@cache/redis.client";
import { env } from "@config/env";
import { ExampleController } from "@controllers/example.controller";
import { HealthController } from "@controllers/health.controller";
import { SearchController } from "@controllers/search.controller";
import { TrackingController } from "@controllers/tracking.controller";
import { ExampleExperiment } from "@experiments/definitions/example.experiment";
import { ExperimentEvaluator } from "@experiments/experiment-evaluator";
import { logger } from "@observability/logger";
import { ExampleSearchProvider } from "@providers/example/example.provider";
import { MockSearchProvider } from "@providers/mock/mock.provider";
import { SearchProviderRegistry } from "@providers/provider.registry";
import { ExampleService } from "@services/example.service";
import { PersonalizationService } from "@services/personalization.service";
import { SearchService } from "@services/search.service";
import { TrackingService } from "@services/tracking.service";
import { SearchProviderId } from "@domain-types/provider.types";

export interface ApplicationContainer {
	readonly searchController: SearchController;
	readonly trackingController: TrackingController;
	readonly healthController: HealthController;
	readonly exampleController: ExampleController;
	readonly analyticsDispatcher: AnalyticsDispatcher;
	readonly shutdown: () => Promise<void>;
}

export function initializeContainer(): ApplicationContainer {
	logger.info("Initializing Application Dependency Container...");

	// 1. Storage & Cache (Redis)
	const redis = RedisClientFactory.getClient();
	const personalizationService = new PersonalizationService(redis);

	// 2. Analytics Sinks & Dispatcher (Postgres & Example)
	const analyticsDispatcher = new AnalyticsDispatcher();
	analyticsDispatcher.registerSink(new ExampleAnalyticsSink());
	analyticsDispatcher.registerSink(new PostgresAnalyticsSink());

	// 3. Search Providers & Registry (Mock & Example)
	const providerRegistry = new SearchProviderRegistry();

	const mockProvider = new MockSearchProvider();
	providerRegistry.register(mockProvider);

	const exampleProvider = new ExampleSearchProvider();
	providerRegistry.register(exampleProvider);

	// Set default provider from configuration
	providerRegistry.setDefaultProvider(env.DEFAULT_PROVIDER as SearchProviderId);

	// 4. Experiments Engine
	const experimentEvaluator = new ExperimentEvaluator();
	experimentEvaluator.register(ExampleExperiment);

	// 5. Application Services
	const searchService = new SearchService(
		providerRegistry,
		experimentEvaluator,
		personalizationService,
		analyticsDispatcher
	);

	const trackingService = new TrackingService(analyticsDispatcher, personalizationService);
	const exampleService = new ExampleService();

	// 6. Controllers
	const searchController = new SearchController(searchService);
	const trackingController = new TrackingController(trackingService);
	const healthController = new HealthController(providerRegistry);
	const exampleController = new ExampleController(exampleService);

	return {
		searchController,
		trackingController,
		healthController,
		exampleController,
		analyticsDispatcher,
		shutdown: async () => {
			logger.info("Shutting down application container...");
			await analyticsDispatcher.shutdown();
			await RedisClientFactory.close();
		},
	};
}
