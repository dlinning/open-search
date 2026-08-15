import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

//#region IController
export interface IController {
	readonly params: IControllerConstructorParams | undefined;

	readonly routes: ControllerRoutes;
}

export interface IControllerConstructorParams {
	/**
	 * Prefix to routes
	 *
	 * @example "/foo" -> `/foo/{routes[0].routeUrl}`
	 */
	urlPrefix: `/${string}`;
}

/**
 * Dictionary of controller routes mapped by action name.
 */
export type ControllerRoutes = ReadonlyArray<RouteDefinition>;

/**
 * Supported HTTP methods for route registration.
 */
export type FastifyHttpMethod = Extract<
	keyof FastifyInstance,
	"get" | "post" | "put" | "patch" | "delete" | "head" | "options"
>;

/**
 * Standard asynchronous route handler function signature for Fastify.
 * Applying `: RouteHandler` to controller methods provides full inference
 * for `(req, reply)` parameters without manual typing.
 */
export type FastifyRouteHandler<
	TRequest extends FastifyRequest = FastifyRequest,
	TReply extends FastifyReply = FastifyReply,
> = (req: TRequest, reply: TReply) => Promise<void>;

/**
 * Strongly-typed descriptor for a single controller endpoint route.
 */
export interface RouteDefinition {
	readonly method: FastifyHttpMethod;
	readonly path: string;
	readonly handler: FastifyRouteHandler;
}
//#endregion IController

/**
 * Standardized API Response model for all Endpoints.
 */
export interface IApiResponseEnvelope<T = unknown> {
	readonly success: boolean;
	readonly data?: T;
	readonly message?: string;
	readonly metadata?: Readonly<Record<string, unknown>>;
}
