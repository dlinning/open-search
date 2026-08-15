/**
 * ============================================================================
 * EXAMPLE TEMPLATE: example.service.ts
 * ============================================================================
 * Use this file as a reference template when creating new application services.
 *
 * Rules:
 * 1. Implement domain interfaces (e.g. `IExampleService`).
 * 2. Inject dependencies via constructor (Inversion of Control).
 * 3. Never use `any`. Use strongly typed entities and domain errors.
 * ============================================================================
 */

import { IExampleService } from "@interfaces/example.interface";
import { logger } from "@observability/logger";
import { SearchRequestDto } from "@typing/search-request.types";

export class ExampleService implements IExampleService {
	constructor(private readonly prefix: string = "Example") {}

	public async processExample(request: SearchRequestDto): Promise<string> {
		logger.debug({ query: request.query }, "Processing example service request");
		return `${this.prefix}: Processed search query "${request.query}" for session ${request.userContext.sessionId}`;
	}

	public validateState(): boolean {
		return true;
	}
}
