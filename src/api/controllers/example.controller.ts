/**
 * ============================================================================
 * EXAMPLE TEMPLATE: example.controller.ts
 * ============================================================================
 * Use this file as a reference template when implementing Fastify route handlers.
 *
 * Rules:
 * 1. Subclass `BaseController` to leverage standard response envelopes.
 * 2. Define the `routes` dictionary mapping action names to method, path, and handler.
 * 3. Type handlers using `: RouteHandler` to automatically infer `(req, reply)`.
 * ============================================================================
 */

import { BaseController } from "@controllers/base.controller";
import { ControllerRoutes, FastifyRouteHandler } from "@interfaces/controller.interface";
import { IExampleService } from "@interfaces/example.interface";
import { SearchRequestDto } from "@typing/search-request.types";
import { exampleRequestSchema } from "@validation/example.schema";

export class ExampleController extends BaseController {
	constructor(private readonly exampleService: IExampleService) {
		super();
	}

	public readonly routes: ControllerRoutes = {
		exampleAction: {
			method: "post",
			path: "/example",
			handler: (req, reply) => this.handleExampleAction(req, reply),
		},
	};

	public handleExampleAction: FastifyRouteHandler = async (req, reply) => {
		const input = exampleRequestSchema.parse(req.body);

		const searchStub: SearchRequestDto = {
			query: input.name,
			pagination: { page: 1, pageSize: input.limit },
			userContext: this.getUserContext(req),
		};

		const output = await this.exampleService.processExample(searchStub);

		this.ok(reply, {
			processed: output,
			tags: input.tags,
		});
	};
}
