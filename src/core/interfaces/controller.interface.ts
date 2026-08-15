import { FastifyReply, FastifyRequest } from "fastify";

/**
 * Supported HTTP methods for route registration (accepts both uppercase and lowercase).
 */
export type HttpMethod =
	| "get"
	| "post"
	| "put"
	| "patch"
	| "delete"
	| "head"
	| "options"
	| "GET"
	| "POST"
	| "PUT"
	| "PATCH"
	| "DELETE"
	| "HEAD"
	| "OPTIONS";

/**
 * Standard asynchronous route handler function signature for Fastify.
 * Applying `: RouteHandler` to controller methods provides full inference
 * for `(req, reply)` parameters without manual typing.
 */
export type RouteHandler<
	TRequest extends FastifyRequest = FastifyRequest,
	TReply extends FastifyReply = FastifyReply,
> = (req: TRequest, reply: TReply) => Promise<void>;

/**
 * Alias for RouteHandler.
 */
export type FastifyRouteHandler = RouteHandler;

/**
 * Strongly-typed descriptor for a single controller endpoint route.
 */
export interface RouteDefinition {
	readonly method: HttpMethod;
	readonly path: string;
	readonly handler: RouteHandler;
}

/**
 * Strongly-typed dictionary of controller routes mapped by action name.
 */
export type ControllerRoutes = Readonly<Record<string, RouteDefinition>>;
