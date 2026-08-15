import { APP_CONSTANTS } from "@config/constants";
import { ControllerRoutes, HttpMethod, RouteHandler } from "@interfaces/controller.interface";
import { UserContext } from "@typing/search-request.types";
import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

export interface ApiResponseEnvelope<T = unknown> {
	readonly success: boolean;
	readonly data?: T;
	readonly message?: string;
	readonly metadata?: Readonly<Record<string, unknown>>;
}

export abstract class BaseController {
	/**
	 * Strongly-typed dictionary of routes registered by this controller.
	 */
	public abstract readonly routes: ControllerRoutes;

	/**
	 * Sends a 200 OK response with a standard data envelope.
	 */
	protected ok<T>(
		reply: FastifyReply,
		data: T,
		metadata?: Readonly<Record<string, unknown>>
	): void {
		const response: ApiResponseEnvelope<T> = {
			success: true,
			data,
			metadata,
		};
		void reply.status(200).send(response);
	}

	/**
	 * Sends a 201 Created response.
	 */
	protected created<T>(
		reply: FastifyReply,
		data: T,
		message = "Resource successfully created"
	): void {
		const response: ApiResponseEnvelope<T> = {
			success: true,
			data,
			message,
		};
		void reply.status(201).send(response);
	}

	/**
	 * Sends a 202 Accepted response for background asynchronous tasks.
	 */
	protected accepted<T = unknown>(
		reply: FastifyReply,
		message = "Request accepted for background processing",
		details?: T
	): void {
		const response: ApiResponseEnvelope<T> = {
			success: true,
			message,
			data: details,
		};
		void reply.status(202).send(response);
	}

	/**
	 * Sends a 204 No Content response.
	 */
	protected noContent(reply: FastifyReply): void {
		void reply.status(204).send();
	}

	/**
	 * Helper to retrieve correlation ID from request.
	 */
	protected getCorrelationId(req: FastifyRequest): string {
		return (
			req.correlationId ||
			(typeof req.headers[APP_CONSTANTS.CORRELATION_HEADER] === "string"
				? (req.headers[APP_CONSTANTS.CORRELATION_HEADER] as string)
				: "unknown")
		);
	}

	/**
	 * Helper to retrieve search ID from request.
	 */
	protected getSearchId(req: FastifyRequest): string {
		return (
			req.searchId ||
			(typeof req.headers[APP_CONSTANTS.SEARCH_ID_HEADER] === "string"
				? (req.headers[APP_CONSTANTS.SEARCH_ID_HEADER] as string)
				: "unknown")
		);
	}

	/**
	 * Helper to retrieve user context from request.
	 */
	protected getUserContext(req: FastifyRequest): UserContext {
		return req.userContext;
	}
}

/**
 * Helper to register a route on Fastify dynamically using any HTTP method.
 */
export function registerRoute(
	fastify: FastifyInstance,
	method: HttpMethod,
	endpoint: string,
	handler: RouteHandler
): void {
	const normalizedMethod = method.toLowerCase() as
		"get" | "post" | "put" | "patch" | "delete" | "head" | "options";
	fastify[normalizedMethod](endpoint, handler);
}

/**
 * Helper to register all routes defined in a controller's strongly-typed dictionary.
 */
export function registerController(
	fastify: FastifyInstance,
	controller: BaseController,
	prefix = ""
): void {
	for (const route of Object.values(controller.routes)) {
		const rawPath = `${prefix}/${route.path}`.replace(/\/+/g, "/");
		const endpoint =
			rawPath.endsWith("/") && rawPath.length > 1 ? rawPath.slice(0, -1) : rawPath;
		registerRoute(fastify, route.method, endpoint, route.handler);
	}
}

/**
 * Batch registration helper for multiple controllers.
 */
export function registerControllers(
	fastify: FastifyInstance,
	registrations: ReadonlyArray<{ readonly controller: BaseController; readonly prefix?: string }>
): void {
	for (const { controller, prefix } of registrations) {
		registerController(fastify, controller, prefix);
	}
}
