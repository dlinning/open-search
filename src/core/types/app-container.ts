import { IController } from "@core/interfaces/controller.interface";
import { AnalyticsDispatcher } from "@root/infrastructure/analytics/analytics-dispatcher";

export interface IApplicationContainer {
	/**
	 * Callback for when the application is terminated.
	 *
	 * Any cleanup code should be ran now.
	 *
	 * Calls `.cleanup()` on Controllers and Services
	 */
	readonly shutdown: () => Promise<void>;

	readonly Controllers: ReadonlyArray<IController>;

	readonly AnalyticsDispatcher: AnalyticsDispatcher;
}
