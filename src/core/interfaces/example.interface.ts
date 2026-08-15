/**
 * ============================================================================
 * EXAMPLE TEMPLATE: example.interface.ts
 * ============================================================================
 * Use this file as a reference template when declaring new service contracts
 * and domain interfaces.
 *
 * Rules:
 * 1. Declare method signatures using strict parameter and return types.
 * 2. Never use `any`. Use generics `<T = unknown>` where type flexibility is needed.
 * 3. Document expected asynchronous behaviors and errors.
 * ============================================================================
 */

import { SearchRequestDto } from "@typing/search-request.types";

export interface IExampleService {
	/**
	 * Performs an example domain operation.
	 * @param request - The incoming search request
	 * @returns A promise resolving to an example processed outcome
	 */
	processExample(request: SearchRequestDto): Promise<string>;

	/**
	 * Validates internal state.
	 */
	validateState(): boolean;
}
