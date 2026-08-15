import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import sensible from "@fastify/sensible";
import Fastify, { FastifyInstance } from "fastify";
import { registerControllers } from "@controllers/base.controller";
import { correlationIdMiddleware } from "@middlewares/correlation-id.middleware";
import { errorHandlerMiddleware } from "@middlewares/error-handler.middleware";
import { userContextMiddleware } from "@middlewares/user-context.middleware";
import { ApplicationContainer } from "./bootstrap";

export function createServer(container: ApplicationContainer): FastifyInstance {
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
	registerControllers(fastify, [
		{ controller: container.healthController },
		{ controller: container.searchController, prefix: "/v1" },
		{ controller: container.trackingController, prefix: "/v1" },
		{ controller: container.exampleController, prefix: "/v1" },
	]);

	return fastify;
}
