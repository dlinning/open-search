export class AppError extends Error {
	public readonly statusCode: number;
	public readonly errorCode: string;
	public readonly details?: Record<string, unknown>;

	constructor(
		message: string,
		statusCode = 500,
		errorCode = "INTERNAL_SERVER_ERROR",
		details?: Record<string, unknown>
	) {
		super(message);
		this.name = "AppError";
		this.statusCode = statusCode;
		this.errorCode = errorCode;
		this.details = details;
		Error.captureStackTrace(this, this.constructor);
	}
}

export class NotFoundError extends AppError {
	constructor(message = "Resource not found", details?: Record<string, unknown>) {
		super(message, 404, "NOT_FOUND", details);
	}
}

export class ValidationError extends AppError {
	constructor(message = "Validation failed", details?: Record<string, unknown>) {
		super(message, 400, "VALIDATION_ERROR", details);
	}
}

export class ProviderUnavailableError extends AppError {
	constructor(
		providerId: string,
		message = "Search provider is unavailable",
		details?: Record<string, unknown>
	) {
		super(`Provider '${providerId}' error: ${message}`, 503, "PROVIDER_UNAVAILABLE", {
			providerId,
			...details,
		});
	}
}

export class ProviderTimeoutError extends AppError {
	constructor(providerId: string, timeoutMs: number) {
		super(`Provider '${providerId}' timed out after ${timeoutMs}ms`, 504, "PROVIDER_TIMEOUT", {
			providerId,
			timeoutMs,
		});
	}
}
