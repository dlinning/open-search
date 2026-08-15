import { APP_CONSTANTS } from "@config/constants";
import { UserContext } from "@typing/search-request.types";
import { FastifyReply, FastifyRequest } from "fastify";
import { nanoid } from "nanoid";

declare module "fastify" {
	interface FastifyRequest {
		userContext: UserContext;
	}
}

/**
 * Loads user-level date onto the `FastifyRequest.userContext` object
 */
export async function userContextMiddleware(
	req: FastifyRequest,
	_reply: FastifyReply
): Promise<void> {
	const sessionHeader = req.headers[APP_CONSTANTS.SESSION_ID_HEADER];
	const userHeader = req.headers[APP_CONSTANTS.USER_ID_HEADER];

	req.userContext = {
		// Generates a new Session ID value if none exists
		sessionId: typeof sessionHeader === "string" ? sessionHeader : `sess_${nanoid(21)}`,
		// Take user header only when provided
		userId: typeof userHeader === "string" ? userHeader : undefined,
		userAgent: req.headers["user-agent"],
	};
}
