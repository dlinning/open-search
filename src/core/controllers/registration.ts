import {
	FastifyHttpMethod,
	FastifyRouteHandler,
	IController,
} from "@core/interfaces/controller.interface";
import { IApplicationContainer } from "@core/types/app-container";
import { FastifyInstance } from "fastify";

/**
 * Batch registration helper for multiple controllers.
 */
export function registerControllers(
	fastify: FastifyInstance,
	appContainer: IApplicationContainer
): void {
	for (const controller of appContainer.Controllers) {
		registerController(fastify, controller);
	}
}

/**
 * Helper to register all routes defined in a controller's strongly-typed dictionary.
 */
function registerController(fastify: FastifyInstance, controller: IController): void {
	let controllerPrefix = controller.params?.urlPrefix ?? "";
	const hasPrefix = typeof controllerPrefix === "string" && controllerPrefix.length > 0;

	if (hasPrefix && controllerPrefix.startsWith("/") === false) {
		controllerPrefix = `/${controllerPrefix}`;
	}

	for (const route of controller.routes) {
		//#region Path Merging
		// Ensure proper slashes
		const rawPath = `${controllerPrefix}/${route.path}`.replace(/\/+/g, "/");

		// Allow "/" paths, but remove all other trailing slashes
		const endpoint =
			rawPath.endsWith("/") && rawPath.length > 1 ? rawPath.slice(0, -1) : rawPath;
		//#endregion Path Merging

		registerRoute(fastify, route.method, endpoint, route.handler);

		console.log(`Registered: [${route.method}] ${endpoint}`);
	}
}

/**
 * Helper to register a route on Fastify dynamically using any HTTP method.
 */
function registerRoute(
	fastify: FastifyInstance,
	method: FastifyHttpMethod,
	endpoint: string,
	handler: FastifyRouteHandler
): void {
	fastify[method](endpoint, handler);
}
