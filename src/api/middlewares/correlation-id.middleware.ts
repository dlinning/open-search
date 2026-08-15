import { APP_CONSTANTS } from "@config/constants";
import { FastifyReply, FastifyRequest } from "fastify";
import { v7 as uuidV7 } from "uuid";

declare module "fastify" {
	interface FastifyRequest {
		correlationId: string;
		searchId: string;
	}
}

export async function correlationIdMiddleware(
	req: FastifyRequest,
	reply: FastifyReply
): Promise<void> {
	let correlationId = req.headers[APP_CONSTANTS.CORRELATION_HEADER];
	let searchId = req.headers[APP_CONSTANTS.SEARCH_ID_HEADER];

	// Ensure values are set on both header values
	if (typeof correlationId !== "string") {
		correlationId = uuidV7();
	}

	if (typeof searchId !== "string") {
		searchId = uuidV7();
	}

	// Load onto the current request
	req.correlationId = correlationId;
	req.searchId = searchId;

	// Set the header on the reply
	void reply.header(APP_CONSTANTS.CORRELATION_HEADER, req.correlationId);
	void reply.header(APP_CONSTANTS.SEARCH_ID_HEADER, req.searchId);
}
