/**
 * ============================================================================
 * EXAMPLE TEMPLATE: example.middleware.ts
 * ============================================================================
 * Use this file as a reference template when creating Fastify preHandler
 * or onRequest middlewares.
 *
 * Rules:
 * 1. Declare async middleware functions accepting `(req, reply)`.
 * 2. Augment `FastifyRequest` via declaration merging if adding custom properties.
 * 3. Never use `any`. Use strict TypeScript types.
 * ============================================================================
 */

import { FastifyReply, FastifyRequest } from "fastify";
import { logger } from "@observability/logger";

declare module "fastify" {
	interface FastifyRequest {
		exampleTimestamp?: number;
	}
}

export async function exampleMiddleware(req: FastifyRequest, _reply: FastifyReply): Promise<void> {
	req.exampleTimestamp = Date.now();
	logger.trace({ path: req.url, timestamp: req.exampleTimestamp }, "Example middleware executed");
}
