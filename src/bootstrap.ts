import { AnalyticsDispatcher } from "@analytics/analytics-dispatcher";
import { ExampleAnalyticsSink } from "@analytics/sinks/example.sink";
import { PostgresAnalyticsSink } from "@analytics/sinks/postgres.sink";
import { RedisClientFactory } from "@cache/redis.client";
import { env } from "@config/env";
import { ExampleController } from "@controllers/example.controller";
import { HealthController } from "@core/controllers/health.controller";
import { SearchController } from "@core/controllers/search.controller";
import { TrackingController } from "@core/controllers/tracking.controller";
import { IApplicationContainer } from "@core/types/app-container";
import { SearchProviderId } from "@domain-types/provider.types";
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

/**
 * Handles registering all Containers, Services, and Providers.
 */
export function registerAppContainer(): IApplicationContainer {
	logger.info("Initializing Application Dependency Container...");

	// Storage & Cache (Redis)
	const redis = RedisClientFactory.getClient();
	const personalizationService = new PersonalizationService(redis);

	// #region Analytics Sinks & Dispatcher
	const analyticsDispatcher = new AnalyticsDispatcher();
	analyticsDispatcher.registerSink(new ExampleAnalyticsSink());
	analyticsDispatcher.registerSink(new PostgresAnalyticsSink());
	// #endregion Analytics Sinks & Dispatcher

	//#region Search Providers & Registry
	const providerRegistry = new SearchProviderRegistry();

	const mockProvider = new MockSearchProvider();
	providerRegistry.register(mockProvider);

	const exampleProvider = new ExampleSearchProvider();
	providerRegistry.register(exampleProvider);

	// Set default provider from configuration
	providerRegistry.setDefaultProvider(env.DEFAULT_PROVIDER as SearchProviderId);
	//#endregion Search Providers & Registry

	// Experiments Engine
	const experimentEvaluator = new ExperimentEvaluator();
	experimentEvaluator.register(ExampleExperiment);

	// #region Application Services
	const searchService = new SearchService(
		providerRegistry,
		experimentEvaluator,
		personalizationService,
		analyticsDispatcher
	);

	const trackingService = new TrackingService(analyticsDispatcher, personalizationService);
	const exampleService = new ExampleService();
	// #end Application Services

	const AppContainer: IApplicationContainer = {
		// #region Register Controllers
		Controllers: [
			new HealthController(providerRegistry),
			new TrackingController(trackingService),
			new SearchController(searchService),
			//
			// Add new Controllers below
			//
			new ExampleController(exampleService),
		],
		AnalyticsDispatcher: analyticsDispatcher,
		// #endregion Register Controllers

		shutdown: async () => {
			logger.info("Shutting down application container...");
			await analyticsDispatcher.shutdown();
			await RedisClientFactory.close();
		},
	};

	return AppContainer;
}
