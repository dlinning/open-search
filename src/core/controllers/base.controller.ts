import { APP_CONSTANTS } from "@config/constants";
import {
	ControllerRoutes,
	IApiResponseEnvelope,
	IController,
	IControllerConstructorParams,
} from "@interfaces/controller.interface";
import { UserContext } from "@typing/search-request.types";
import { FastifyReply, FastifyRequest } from "fastify";

/**
 * Basic class for Controllers, that all Controllers must implement.
 */
export abstract class BaseController implements IController {
	/**
	 * Strongly-typed dictionary of routes registered by this controller.
	 */
	public abstract readonly routes: ControllerRoutes;

	readonly params: IControllerConstructorParams | undefined;

	constructor(params: IControllerConstructorParams) {
		this.params = { ...params };
	}

	//#region Protected / Internal methods
	/**
	 * Sends a 200 OK response with a standard data envelope.
	 */
	protected ok<T>(
		reply: FastifyReply,
		data: T,
		metadata?: Readonly<Record<string, unknown>>
	): void {
		const response: IApiResponseEnvelope<T> = {
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
		const response: IApiResponseEnvelope<T> = {
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
		const response: IApiResponseEnvelope<T> = {
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
	//#endregion Protected / Internal methods
}
