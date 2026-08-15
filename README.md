# OpenSearch Product API

> Enterprise-grade, high-throughput Product Search Orchestration Gateway built with **Fastify**, **TypeScript**, **Redis**, **PostgreSQL**, and **Vitest**. Features pluggable vendor backends, deterministic MurmurHash3 A/B experimentation, sub-2ms Redis session personalization, non-blocking batched analytics, and declarative controller route dictionaries with zero routing boilerplate.

---

## Architecture & System Overview

```
[ Client Applications: Web, Mobile BFF, Storefront ]
                         │
                         ▼
┌────────────────────────────────────────────────────────┐
│ FASTIFY APPLICATION GATEWAY                            │
│  ├── Correlation & User Context Middleware             │
│  ├── Declarative Controller Route Dictionaries         │
│  ├── MurmurHash3 Deterministic A/B Engine              │
│  ├── Redis Real-Time Session Affinity (<2ms)           │
│  └── Resilient Provider Router (Circuit Breakers)      │
│         ├── In-Memory Mock Provider (Catalog Data)     │
│         └── Example Search Provider (Template Backend) │
└────────────┬──────────────────────────────┬────────────┘
             │                              │
             ▼                              ▼
  [ Synchronous JSON Output ]     [ Async Analytics Dispatcher ]
                                  ├── PostgreSQL Sink
                                  └── Example Analytics Sink
```

---

## Key Capabilities

- **Vendor-Agnostic Search Abstraction**: Standardized `ISearchProvider` interface contract allowing seamless integration of any search engine without modifying frontend endpoints.
- **AST Filter Expression Tree**: Powerful boolean filtering with nested logic (`AND`, `OR`, `NOT`), range bounds (`BETWEEN`, `GTE`, `LTE`), equality operators (`EQ`, `NEQ`, `IN`, `NIN`), and disjunctive faceting.
- **Deterministic A/B Testing**: MurmurHash3 stateless user bucketing across orthogonal scopes (`PROVIDER`, `QUERY_REWRITE`, `RANKING_BOOST`, `FACET_LAYOUT`).
- **Real-Time Session Personalization**: Closed-loop clickstream feedback (`/v1/track`) instantly updating user brand/category affinities in Redis to boost subsequent search rankings in `< 2ms`.
- **Non-Blocking Asynchronous Analytics**: High-throughput memory buffer with micro-batch flushing to PostgreSQL and custom analytical sinks, fully correlated via `searchId` tokens.
- **Resilience & Fault Tolerance**: Provider Circuit Breakers (`opossum`), `AbortSignal` timeout handling, and automatic failover to the default fallback provider.

---

## File & Directory Structure

```plaintext
open-search/
├── src/
│   ├── api/
│   │   ├── controllers/            # BaseController & Strongly-Typed Route Dictionaries
│   │   │   ├── base.controller.ts  # Route registration helpers (registerControllers, registerRoute)
│   │   │   ├── health.controller.ts# Liveness (/health) & Readiness (/health/readiness) probes
│   │   │   ├── search.controller.ts# GET /v1/search & POST /v1/search query endpoints
│   │   │   ├── tracking.controller.ts# POST /v1/track clickstream event ingestion
│   │   │   └── example.controller.ts # Extensibility template controller
│   │   ├── middlewares/            # Fastify request lifecycle hooks
│   │   │   ├── correlation-id.middleware.ts  # x-correlation-id & x-search-id tracing
│   │   │   ├── user-context.middleware.ts    # Session, geo, and user extraction
│   │   │   ├── error-handler.middleware.ts   # Centralized domain error envelope handler
│   │   │   └── example.middleware.ts         # Template middleware
│   │   └── validation/             # Zod input validation schemas
│   │       ├── search.schema.ts
│   │       ├── tracking.schema.ts
│   │       └── example.schema.ts
│   ├── config/                     # Application configuration & constants
│   │   ├── env.ts                  # Zod-validated environment configuration
│   │   └── constants.ts            # Application HTTP headers & defaults
│   ├── core/                       # Pure domain models, interfaces, and errors
│   │   ├── errors/
│   │   │   └── app-error.ts        # AppError, NotFoundError, ValidationError, ProviderTimeoutError
│   │   ├── interfaces/
│   │   │   ├── controller.interface.ts         # RouteHandler, HttpMethod, RouteDefinition, ControllerRoutes
│   │   │   ├── search-provider.interface.ts    # ISearchProvider & vendor contract
│   │   │   ├── analytics-sink.interface.ts     # IAnalyticsSink batch flush contract
│   │   │   ├── personalization-store.interface.ts # IPersonalizationStore Redis contract
│   │   │   ├── experiment-engine.interface.ts  # IExperimentEngine A/B testing contract
│   │   │   └── example.interface.ts            # Extensibility template interface
│   │   └── types/                  # Immutable domain types & DTOs
│   │       ├── search-request.types.ts         # AST Filter nodes, Pagination, UserContext
│   │       ├── search-response.types.ts        # ProductHit, Facets, Telemetry DTO
│   │       ├── provider.types.ts               # SearchProviderId, ProviderCapability
│   │       ├── analytics.types.ts              # AnalyticsEventDto, Clickstream payloads
│   │       ├── experiment.types.ts             # ExperimentDefinition, VariantAssignment
│   │       └── example.types.ts
│   ├── infrastructure/             # Concrete adapters & external integrations
│   │   ├── analytics/
│   │   │   ├── analytics-dispatcher.ts         # Memory ring-buffer & async sink dispatcher
│   │   │   └── sinks/
│   │   │       ├── postgres.sink.ts            # PostgreSQL transactional analytical sink
│   │   │       └── example.sink.ts             # In-memory template analytical sink
│   │   ├── cache/
│   │   │   └── redis.client.ts                 # Resilient Redis connection manager (degraded fallback)
│   │   ├── experiments/
│   │   │   ├── experiment-evaluator.ts         # MurmurHash3 deterministic bucketing engine
│   │   │   └── definitions/
│   │   │       └── example.experiment.ts       # Sample A/B ranking boost experiment
│   │   ├── observability/
│   │   │   └── logger.ts                       # Pino structured JSON & Pretty logger
│   │   └── providers/
│   │       ├── base.provider.ts                # BaseSearchProvider with Circuit Breaker
│   │       ├── provider.registry.ts            # Dynamic provider registry & resolver
│   │       ├── mock/
│   │       │   ├── mock.provider.ts            # In-memory keyword search, filtering, and facets
│   │       │   └── mock.data.ts                # Rich eCommerce mock product catalog
│   │       └── example/
│   │           ├── example.provider.ts         # Provider adapter template
│   │           ├── example.mapper.ts           # Vendor DTO transformation mapper
│   │           └── example.types.ts            # Vendor raw payload schemas
│   ├── services/                   # Application orchestration services
│   │   ├── search.service.ts       # Multi-provider dispatch, A/B evaluation, and personalization
│   │   ├── personalization.service.ts # Redis session affinity store
│   │   ├── tracking.service.ts     # Clickstream event ingestion & feedback loop
│   │   └── example.service.ts      # Template service
│   ├── bootstrap.ts                # Application composition root & dependency container
│   ├── server.ts                   # Fastify server instance & route dispatcher
│   └── index.ts                    # Application entrypoint & graceful shutdown
├── test/
│   ├── integration/
│   │   └── api-smoke.test.ts       # Fastify inject E2E smoke tests
│   └── unit/
│       ├── experiment-evaluator.test.ts # A/B testing bucketing unit tests
│       └── mock-provider.test.ts        # Filtering, faceting, & boost unit tests
├── .env                            # Active environment file
├── .env.example                    # Documented environment template
├── .oxlintrc.json                  # Strict Oxlint configuration (zero warnings)
├── .prettierrc                     # Prettier formatting rules
├── tsconfig.json                   # Path alias mappings (@controllers, @services, etc.)
├── vitest.config.mts               # Vitest configuration with native tsconfig path support
└── package.json
```

---

## Getting Started

### Prerequisites

- **Node.js**: `v20.0.0` or higher
- **Yarn**: `v1.22.x` or higher
- **Redis** _(Optional for local dev)_: The application automatically operates in degraded mode if Redis is offline.

### 1. Installation

```bash
yarn install
```

### 2. Environment Configuration

Copy the documented example environment file to `.env`:

```bash
cp .env.example .env
```

### 3. Running the Server

#### Development Mode (Hot-Reloading)

```bash
yarn dev
```

Starts the server at `http://localhost:3000` with instant hot-reloading via `tsx watch`.

#### Production Mode

```bash
yarn build
yarn start
```

Compiles TypeScript, rewrites path aliases via `tsc-alias`, and executes the optimized production bundle from `dist/index.js`.

---

## Controller Route Dictionary Pattern

All controllers inherit from `BaseController` and expose a strongly-typed `routes: ControllerRoutes` dictionary:

```typescript
// src/api/controllers/search.controller.ts
import { BaseController } from '@controllers/base.controller';
import { ControllerRoutes, RouteHandler } from '@interfaces/controller.interface';
import { SearchService } from '@services/search.service';

export class SearchController extends BaseController {
  constructor(private readonly searchService: SearchService) {
    super();
  }

  public readonly routes: ControllerRoutes = {
    getSearch: {
      method: 'GET',
      path: '/search',
      handler: (req, reply) => this.handleGetSearch(req, reply),
    },
    postSearch: {
      method: 'POST',
      path: '/search',
      handler: (req, reply) => this.handlePostSearch(req, reply),
    },
  };

  public handleGetSearch: RouteHandler = async (req, reply) => {
    // req and reply are fully typed automatically
    const result = await this.searchService.executeSearch(...);
    this.ok(reply, result);
  };
}
```

In `src/server.ts`, controllers are registered directly:

```typescript
registerControllers(fastify, [
	{ controller: container.healthController },
	{ controller: container.searchController, prefix: "/v1" },
	{ controller: container.trackingController, prefix: "/v1" },
	{ controller: container.exampleController, prefix: "/v1" },
]);
```

---

## API Reference & Endpoints

### 1. Health Checks

#### Liveness Probe

```http
GET /health
```

```json
{
	"status": "ok",
	"uptime": 14.8,
	"timestamp": "2026-08-15T18:30:00.000Z"
}
```

#### Readiness Probe

```http
GET /health/readiness
```

```json
{
	"status": "ready",
	"providers": {
		"mock": true,
		"example": true
	},
	"timestamp": "2026-08-15T18:30:00.000Z"
}
```

---

### 2. Search Endpoints

#### Simple Query (`GET /v1/search`)

```http
GET /v1/search?q=running&page=1&pageSize=10
```

#### Advanced Search with AST Filters (`POST /v1/search`)

```http
POST /v1/search
Content-Type: application/json

{
  "query": "Nike",
  "pagination": {
    "page": 1,
    "pageSize": 10
  },
  "filters": {
    "type": "composite",
    "logic": "AND",
    "filters": [
      { "type": "leaf", "field": "inStock", "operator": "EQ", "value": true },
      { "type": "leaf", "field": "regularPrice", "operator": "LTE", "value": 200 }
    ]
  },
  "facetsRequested": ["brand", "categories", "inStock"]
}
```

**Response (`200 OK`)**:

```json
{
	"success": true,
	"data": {
		"searchId": "0188e7b1-2856-7890-a123-456789abcdef",
		"query": "Nike",
		"pagination": {
			"page": 1,
			"pageSize": 10,
			"totalHits": 1,
			"totalPages": 1
		},
		"items": [
			{
				"id": "prod_001",
				"sku": "NK-RN-001",
				"title": "Nike Air Zoom Pegasus 40",
				"brand": "Nike",
				"categories": ["Footwear", "Running", "Men"],
				"price": {
					"currency": "USD",
					"regularPrice": 130,
					"salePrice": 104,
					"discountPercentage": 20
				},
				"inStock": true,
				"inventoryCount": 45,
				"rating": { "average": 4.7, "count": 128 }
			}
		],
		"facets": [
			{
				"field": "brand",
				"displayName": "Brand",
				"type": "terms",
				"buckets": [{ "value": "Nike", "count": 1 }]
			}
		],
		"telemetry": {
			"executionTimeMs": 8,
			"providerExecutionTimeMs": 2,
			"provider": "mock",
			"fallbackTriggered": false
		}
	}
}
```

---

### 3. Clickstream Tracking & Personalization Loop

```http
POST /v1/track
Content-Type: application/json
x-session-id: sess_client_001

{
  "eventType": "search_result_click",
  "searchId": "0188e7b1-2856-7890-a123-456789abcdef",
  "payload": {
    "clickedItemId": "prod_001",
    "rankPosition": 1,
    "customMetadata": {
      "category": "Footwear",
      "brand": "Nike"
    }
  }
}
```

**Response (`202 Accepted`)**:

```json
{
	"success": true,
	"message": "Event accepted for processing",
	"data": {
		"eventId": "0188e7b2-1044-7123-b123-999988887777"
	}
}
```

---

## Developer Scripts & Testing

| Command           | Description                                              |
| ----------------- | -------------------------------------------------------- |
| `yarn dev`        | Start development server with hot-reload via `tsx watch` |
| `yarn build`      | Typecheck, lint, compile TypeScript, and build the site  |
| `yarn start`      | Run compiled build                                       |
| `yarn test`       | Run Vitest unit and integration test suites              |
| `yarn test:watch` | Run Vitest in interactive watch mode                     |
| `yarn typecheck`  | Run TypeScript type-checker                              |
| `yarn lint`       | Run Oxlint                                               |

---

## Adding a New Search Provider

To add a new search backend:

1. Register its identifier in `src/core/types/provider.types.ts`.
2. Implement your provider mapper in `src/infrastructure/providers/<name>/<name>.mapper.ts`.
3. Create `src/infrastructure/providers/<name>/<name>.provider.ts` extending `BaseSearchProvider`.
4. Register the provider in `src/bootstrap.ts`:
    ```typescript
    providerRegistry.register(new MyProvider(...));
    ```

---

## License

MIT
