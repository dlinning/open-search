import { QueryBoostParameters, UserContext } from "@typing/search-request.types";

export interface UserAffinityUpdate {
	readonly category?: string;
	readonly brand?: string;
	readonly weight?: number;
}

export interface IPersonalizationStore {
	/**
	 * Retrieves active query boost parameters for a given session or user.
	 */
	getSessionBoosts(userContext: UserContext): Promise<QueryBoostParameters | undefined>;

	/**
	 * Records a user interaction and updates session affinity weights.
	 */
	recordInteraction(sessionId: string, update: UserAffinityUpdate): Promise<void>;
}
