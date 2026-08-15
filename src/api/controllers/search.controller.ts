import { BaseController } from "@controllers/base.controller";
import { ControllerRoutes, FastifyRouteHandler } from "@interfaces/controller.interface";
import { SearchService } from "@services/search.service";
import { SearchRequestDto } from "@typing/search-request.types";
import { searchRequestBodySchema, searchRequestQuerySchema } from "@validation/search.schema";

export class SearchController extends BaseController {
	constructor(private readonly searchService: SearchService) {
		super();
	}

	public readonly routes: ControllerRoutes = {
		getSearch: {
			method: "get",
			path: "/search",
			handler: (req, reply) => this.handleGetSearch(req, reply),
		},
		postSearch: {
			method: "post",
			path: "/search",
			handler: (req, reply) => this.handlePostSearch(req, reply),
		},
	};

	public handleGetSearch: FastifyRouteHandler = async (req, reply) => {
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

		const result = await this.searchService.executeSearch(searchDto, this.getSearchId(req));
		this.ok(reply, result);
	};

	public handlePostSearch: FastifyRouteHandler = async (req, reply) => {
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

		const result = await this.searchService.executeSearch(searchDto, this.getSearchId(req));
		this.ok(reply, result);
	};
}
