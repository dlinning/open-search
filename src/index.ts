import { env } from "@config/env";
import { logger } from "@observability/logger";
import { initializeContainer } from "./bootstrap";
import { createServer } from "./server";

async function main(): Promise<void> {
	const container = initializeContainer();
	const server = createServer(container);

	//#region Graceful Shutdown
	const shutdown = async (signal: string) => {
		logger.info(`Received ${signal}. Gracefully shutting down...`);
		try {
			await server.close();
			await container.shutdown();
			logger.info("Server shutdown completed.");
			process.exit(0);
		} catch (err) {
			logger.error({ err }, "Error during graceful shutdown");
			process.exit(1);
		}
	};

	process.on("SIGTERM", () => {
		void shutdown("SIGTERM");
	});

	process.on("SIGINT", () => {
		void shutdown("SIGINT");
	});
	//#endregion Graceful Shutdown

	//#region Error logging
	process.on("unhandledRejection", (reason: unknown) => {
		logger.error({ reason }, "Unhandled Promise Rejection");
	});

	process.on("uncaughtException", (err: Error) => {
		logger.error({ err: err.message, stack: err.stack }, "Uncaught Exception");
	});
	//#endregion Error logging

	try {
		const address = await server.listen({
			port: env.PORT,
			host: env.HOST,
		});
		logger.info(`OpenSearch Product API running at ${address}`);
		logger.info(`Active Environment: ${env.NODE_ENV}`);
		logger.info(`Default Provider: ${env.DEFAULT_PROVIDER}`);
	} catch (err) {
		logger.error({ err }, "Failed to start server");
		process.exit(1);
	}
}

void main();
