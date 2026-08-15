import { AppError } from "@errors/app-error";
import { ISearchProvider } from "@interfaces/search-provider.interface";
import { logger } from "@observability/logger";
import { SearchProviderId } from "@typing/provider.types";

export class SearchProviderRegistry {
	private readonly providers = new Map<SearchProviderId, ISearchProvider>();
	private defaultProviderId: SearchProviderId = SearchProviderId.MOCK;

	public register(provider: ISearchProvider): this {
		this.providers.set(provider.providerId, provider);
		logger.info({ providerId: provider.providerId }, "Registered search provider");
		return this;
	}

	public setDefaultProvider(providerId: SearchProviderId): void {
		if (!this.providers.has(providerId)) {
			throw new Error(`Cannot set default provider to unregistered ID: ${providerId}`);
		}
		this.defaultProviderId = providerId;
	}

	public get(providerId?: SearchProviderId): ISearchProvider {
		const targetId = providerId || this.defaultProviderId;
		const provider = this.providers.get(targetId);

		if (!provider) {
			const available = Array.from(this.providers.keys()).join(", ");
			throw new AppError(
				`Search provider '${targetId}' not configured or available. Available: [${available}]`,
				500,
				"PROVIDER_NOT_CONFIGURED"
			);
		}

		return provider;
	}

	public getFallback(failedProviderId: SearchProviderId): ISearchProvider | null {
		for (const [id, provider] of this.providers.entries()) {
			if (id !== failedProviderId) {
				return provider;
			}
		}
		return null;
	}

	public listAvailable(): readonly SearchProviderId[] {
		return Array.from(this.providers.keys());
	}
}
