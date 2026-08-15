import { BaseController } from "@core/controllers/base.controller";
import { ControllerRoutes } from "@interfaces/controller.interface";
import { SearchService } from "@services/search.service";
import { SearchRequestDto } from "@typing/search-request.types";
import { searchRequestBodySchema, searchRequestQuerySchema } from "@validation/search.schema";

export class SearchController extends BaseController {
	constructor(private readonly searchService: SearchService) {
		super({
			urlPrefix: "/search",
		});
	}

	public readonly routes: ControllerRoutes = [
		{
			method: "get",
			path: "/search",
			handler: async (req, reply) => {
				const queryInput = searchRequestQuerySchema.parse(req.query);

				const searchDto: SearchRequestDto = {
					query: queryInput.q,
					providerId: queryInput.provider,
					pagination: {
						page: queryInput.page,
						pageSize: queryInput.pageSize,
					},
					userContext: this.getUserContext(req),
					enablePersonalization: queryInput.enablePersonalization,
					debug: queryInput.debug,
				};

				const result = await this.searchService.executeSearch(
					searchDto,
					this.getSearchId(req)
				);

				this.ok(reply, result);
			},
		},
		{
			method: "post",
			path: "/search",
			handler: async (req, reply) => {
				const bodyInput = searchRequestBodySchema.parse(req.body);

				const searchDto: SearchRequestDto = {
					query: bodyInput.query,
					providerId: bodyInput.providerId,
					pagination: bodyInput.pagination,
					filters: bodyInput.filters as SearchRequestDto["filters"],
					facetsRequested: bodyInput.facetsRequested,
					sort: bodyInput.sort,
					userContext: this.getUserContext(req),
					enablePersonalization: bodyInput.enablePersonalization,
					debug: bodyInput.debug,
				};

				const result = await this.searchService.executeSearch(
					searchDto,
					this.getSearchId(req)
				);

				this.ok(reply, result);
			},
		},
	];
}
