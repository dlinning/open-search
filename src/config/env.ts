import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
	NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
	PORT: z.coerce.number().int().positive().default(3000),
	HOST: z.string().default("0.0.0.0"),
	LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
	DEFAULT_PROVIDER: z.enum(["mock", "example"]).default("mock"),

	// Redis Cache & Session
	REDIS_URL: z.string().default("redis://localhost:6379"),
	REDIS_SESSION_PREFIX: z.string().default("session:"),
	REDIS_SESSION_TTL_SECONDS: z.coerce.number().int().positive().default(1800),

	// Analytics Engine Sinks (Postgres & In-Memory / Example)
	ANALYTICS_BATCH_SIZE: z.coerce.number().int().positive().default(50),
	ANALYTICS_FLUSH_INTERVAL_MS: z.coerce.number().int().positive().default(1000),
	POSTGRES_URL: z.string().optional(),

	// Resilience & Circuit Breaker
	PROVIDER_TIMEOUT_MS: z.coerce.number().int().positive().default(2500),
	CIRCUIT_BREAKER_ERROR_THRESHOLD: z.coerce.number().int().min(1).max(100).default(50),
	CIRCUIT_BREAKER_RESET_TIMEOUT_MS: z.coerce.number().int().positive().default(10000),
});

export type EnvConfig = z.infer<typeof envSchema>;
export const env: EnvConfig = envSchema.parse(process.env);
