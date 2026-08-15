import { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";
import { AppError } from "@errors/app-error";
import { logger } from "@observability/logger";

export function errorHandlerMiddleware(
	error: FastifyError | Error,
	request: FastifyRequest,
	reply: FastifyReply
): void {
	const correlationId = request.correlationId || "unknown";

	if (error instanceof ZodError) {
		logger.warn({ correlationId, issues: error.issues }, "Request validation failed");
		void reply.status(400).send({
			success: false,
			error: {
				code: "VALIDATION_ERROR",
				message: "Invalid request parameters",
				details: error.issues.map((i) => ({
					path: i.path.join("."),
					message: i.message,
				})),
				correlationId,
			},
		});
		return;
	}

	if (error instanceof AppError) {
		logger.warn(
			{
				correlationId,
				statusCode: error.statusCode,
				code: error.errorCode,
				message: error.message,
				details: error.details,
			},
			"Application domain error occurred"
		);

		void reply.status(error.statusCode).send({
			success: false,
			error: {
				code: error.errorCode,
				message: error.message,
				details: error.details,
				correlationId,
			},
		});
		return;
	}

	logger.error(
		{ correlationId, err: error.message, stack: error.stack },
		"Unhandled internal server error"
	);

	void reply.status(500).send({
		success: false,
		error: {
			code: "INTERNAL_SERVER_ERROR",
			message: "An unexpected internal error occurred",
			correlationId,
		},
	});
}
