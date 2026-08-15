import { SearchProviderId } from "@typing/provider.types";
import { z } from "zod";

const leafFilterSchema = z.object({
	type: z.literal("leaf"),
	field: z.string().min(1),
	operator: z.enum([
		"EQ",
		"NEQ",
		"IN",
		"NIN",
		"GT",
		"GTE",
		"LT",
		"LTE",
		"BETWEEN",
		"CONTAINS",
		"PREFIX",
	]),
	value: z.union([
		z.string(),
		z.number(),
		z.boolean(),
		z.array(z.union([z.string(), z.number()])),
	]),
});

const filterNodeSchema: z.ZodType<unknown> = z.lazy(() =>
	z.union([
		leafFilterSchema,
		z.object({
			type: z.literal("composite"),
			logic: z.enum(["AND", "OR", "NOT"]),
			filters: z.array(filterNodeSchema),
		}),
	])
);

export const searchRequestQuerySchema = z.object({
	q: z.string().default(""),
	provider: z.nativeEnum(SearchProviderId).optional(),
	page: z.coerce.number().int().min(1).default(1),
	pageSize: z.coerce.number().int().min(1).max(100).default(20),
	sort: z.string().optional(),
	enablePersonalization: z
		.enum(["true", "false"])
		.optional()
		.transform((val) => val !== "false"),
	debug: z
		.enum(["true", "false"])
		.optional()
		.transform((val) => val === "true"),
});

export const searchRequestBodySchema = z.object({
	query: z.string().default(""),
	providerId: z.nativeEnum(SearchProviderId).optional(),
	pagination: z
		.object({
			page: z.number().int().min(1).default(1),
			pageSize: z.number().int().min(1).max(100).default(20),
			cursor: z.string().optional(),
		})
		.default({ page: 1, pageSize: 20 }),
	filters: filterNodeSchema.optional(),
	facetsRequested: z.array(z.string()).optional(),
	sort: z
		.array(
			z.object({
				field: z.string(),
				direction: z.enum(["asc", "desc"]),
			})
		)
		.optional(),
	enablePersonalization: z.boolean().default(true),
	debug: z.boolean().default(false),
});

export type SearchRequestQueryInput = z.infer<typeof searchRequestQuerySchema>;
export type SearchRequestBodyInput = z.infer<typeof searchRequestBodySchema>;
