/**
 * ============================================================================
 * EXAMPLE TEMPLATE: example.schema.ts
 * ============================================================================
 * Use this file as a reference template when defining request validation schemas.
 *
 * Rules:
 * 1. Define strict Zod validation constraints.
 * 2. Export inferred TypeScript types.
 * 3. Never use `z.any()`. Use `z.unknown()` or specific union schemas.
 * ============================================================================
 */

import { z } from "zod";

export const exampleRequestSchema = z.object({
	name: z.string().min(2).max(100),
	limit: z.coerce.number().int().min(1).max(50).default(10),
	tags: z.array(z.string()).optional(),
	metadata: z.record(z.unknown()).optional(),
});

export type ExampleRequestInput = z.infer<typeof exampleRequestSchema>;
