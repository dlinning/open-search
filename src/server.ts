import { registerControllers } from "@core/controllers/registration";
import { correlationIdMiddleware } from "@core/middlewares/correlation-id.middleware";
import { errorHandlerMiddleware } from "@core/middlewares/error-handler.middleware";
import { userContextMiddleware } from "@core/middlewares/user-context.middleware";
import { IApplicationContainer } from "@core/types/app-container";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import sensible from "@fastify/sensible";
import Fastify, { FastifyInstance } from "fastify";

export function createServer(container: IApplicationContainer): FastifyInstance {
	const fastify = Fastify({
		logger: false, // Custom Pino logger used
	});

	// Core Security & Utility Plugins
	void fastify.register(cors, { origin: true });
	void fastify.register(helmet, { contentSecurityPolicy: false });
	void fastify.register(sensible);

	// Global Request Hooks
	fastify.addHook("onRequest", correlationIdMiddleware);
	fastify.addHook("preHandler", userContextMiddleware);

	// Centralized Error Handling
	fastify.setErrorHandler(errorHandlerMiddleware);

	// Register all Controller route dictionaries directly
	registerControllers(fastify, container);

	return fastify;
}
