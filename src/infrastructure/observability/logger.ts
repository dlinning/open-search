import pino from "pino";
import { env } from "@config/env";

const isTest = env.NODE_ENV === "test" || Boolean(process.env.VITEST);

export const logger = pino({
	level: isTest ? "silent" : env.LOG_LEVEL,
	transport:
		!isTest && env.NODE_ENV === "development"
			? {
					target: "pino-pretty",
					options: {
						colorize: true,
						translateTime: "SYS:standard",
						ignore: "pid,hostname",
					},
				}
			: undefined,
});
