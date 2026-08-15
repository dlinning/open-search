import { defineConfig } from "vitest/config";

export default defineConfig({
	resolve: {
		tsconfigPaths: true,
	},
	test: {
		globals: true,
		environment: "node",
		include: ["src/test/**/*.test.ts", "src/test/**/*.spec.ts"],
		testTimeout: 10000,
	},
});
