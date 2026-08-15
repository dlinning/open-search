/**
 * ============================================================================
 * EXAMPLE TEMPLATE: example.controller.ts
 * Use this file as a reference template when implementing Fastify route handlers.
 *
 * Rules:
 * - Subclass `BaseController` to leverage standard response envelopes.
 * - Define Params to pass to `BaseController`, such as `urlPrefix`, etc.
 * - Define `routes` array, which get automatically registered in Fastify
 *
 * Registration:
 * - Update `/bootstrap.ts` with the new Controller
 * 	- Inject any Services/Dependencies in the bootstrap file
 * ============================================================================
 */

import { BaseController } from "@core/controllers/base.controller";
import { ControllerRoutes } from "@interfaces/controller.interface";
import { IExampleService } from "@interfaces/example.interface";
import { SearchRequestDto } from "@typing/search-request.types";
import { exampleRequestSchema } from "@validation/example.schema";

export class ExampleController extends BaseController {
	constructor(private readonly exampleService: IExampleService) {
		super({
			urlPrefix: "/example",
		});
	}

	public readonly routes: ControllerRoutes = [
		{
			method: "post",
			path: "/",
			handler: async (req, reply) => {
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
			},
		},
	];
}
