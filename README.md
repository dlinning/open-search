# OpenSearch Product API

> High-throughput, resilient Product Search Orchestration Gateway built with **Fastify**, **TypeScript**, **Redis**, and **Vitest**. Supports pluggable search backends, deterministic A/B experimentation, real-time session personalization, and non-blocking asynchronous analytics.

---

## Key Capabilities

- **Vendor-Agnostic Search Abstraction**: Unifies search providers (Algolia, Commercetools, GCP Vertex AI Search, OpenSearch, and In-Memory Mock) behind a standardized contract (`ISearchProvider`).
- **Resilience & Fault Tolerance**: Per-provider Circuit Breakers (`opossum`), strict `AbortSignal` timeout handling, and automatic failover to fallback providers during vendor outages.
- **AST Filter Expression Tree**: Supports nested boolean logic (`AND`, `OR`, `NOT`), range bounds (`BETWEEN`, `GTE`, `LTE`), and disjunctive/conjunctive facet aggregations.
- **Deterministic A/B Testing**: Hash-based bucketing (MurmurHash3) ensuring stateless, deterministic variant assignment across isolated scopes (`PROVIDER`, `QUERY_REWRITE`, `RANKING_BOOST`, `FACET_LAYOUT`).
- **Real-Time Session Personalization**: Bi-directional feedback loop where clickstream events (`/v1/track`) instantly update user category/brand affinities in Redis to boost subsequent search results in `< 2ms`.
- **Non-Blocking Traced Analytics**: High-throughput memory ring-buffering with micro-batch flushing to pluggable analytical sinks (ClickHouse, PostgreSQL, GA4, Plausible) correlated via unique `searchId` tokens.
- **Declarative Controller Route Dictionaries**: Controllers define strongly-typed `routes` dictionaries registered dynamically without `.routes.ts` boilerplate.
- **Zero `any` Codebase & Strict Tooling**: 100% strict TypeScript types, oxlint linting with zero warnings, and automated Prettier formatting.

---

## Architecture Overview

```
[ Client Applications: Web, Mobile, BFF ]
                  │
                  ▼
┌────────────────────────────────────────────────────────┐
│ FASTIFY APPLICATION GATEWAY                            │
│  ├── Correlation & User Context Middleware             │
│  ├── A/B Experiment Evaluator (MurmurHash3)            │
│  ├── Personalization Engine (Sub-2ms Redis Affinity)   │
│  └── Provider Router (Circuit Breakers + Fallback)     │
│         ├── Algolia Provider                           │
│         ├── Commercetools Provider                     │
│         ├── GCP Vertex Search Provider                 │
│         └── In-Memory Mock Provider (Sample Catalog)   │
└────────────┬──────────────────────────────┬────────────┘
             │                              │
             ▼                              ▼
  [ Synchronous JSON Output ]     [ Async Analytics Dispatcher ]
                                  ├── ClickHouse Sink
                                  ├── PostgreSQL Sink
                                  ├── GA4 Sink
                                  └── Plausible Sink
```

---

## Project Structure

```plaintext
open-search/
├── src/
│   ├── api/
│   │   ├── controllers/            # BaseController & Route Dictionary Handlers
│   │   │   ├── base.controller.ts  # Route registration helpers & response envelopes
│   │   │   ├── health.controller.ts
│   │   │   ├── search.controller.ts
│   │   │   ├── tracking.controller.ts
│   │   │   └── example.controller.ts
│   │   ├── middlewares/            # Correlation ID, User Context, Central Error Handling
│   │   │   ├── correlation-id.middleware.ts
│   │   │   ├── error-handler.middleware.ts
│   │   │   ├── user-context.middleware.ts
│   │   │   └── example.middleware.ts
│   │   └── validation/             # Zod validation schemas
│   │       ├── search.schema.ts
│   │       ├── tracking.schema.ts
│   │       └── example.schema.ts
│   ├── config/                     # Environment configuration & constants
│   │   ├── env.ts                  # Strict Zod-validated environment schema
│   │   └── constants.ts
│   ├── core/                       # Domain models, errors, and interfaces
│   │   ├── errors/                 # Standardized application error hierarchy
│   │   ├── interfaces/             # Provider, Sink, and Controller contracts
│   │   └── types/                  # Request/Response DTOs, Filters AST, Analytics
│   ├── infrastructure/             # Concrete implementations
│   │   ├── analytics/              # Dispatcher & pluggable sinks (ClickHouse, PG, GA4)
│   │   ├── cache/                  # Resilient Redis connection manager
│   │   ├── experiments/            # MurmurHash3 deterministic experiment evaluator
│   │   ├── observability/          # Pino logger
│   │   └── providers/              # Search providers (Algolia, Commercetools, Mock)
│   ├── services/                   # Application orchestration services
│   │   ├── search.service.ts
│   │   ├── personalization.service.ts
│   │   └── tracking.service.ts
│   ├── bootstrap.ts                # Application composition root
│   ├── server.ts                   # Fastify server instance builder
│   └── index.ts                    # Process entrypoint & graceful shutdown
├── test/
│   ├── integration/                # Vitest integration smoke tests (Fastify inject)
│   │   └── api-smoke.test.ts
│   └── unit/                       # Unit tests (Mock Provider, A/B Evaluator)
│       ├── experiment-evaluator.test.ts
│       └── mock-provider.test.ts
├── .env.example                    # Detailed environment template with documentation
├── package.json
├── tsconfig.json                   # Path alias mappings (@controllers, @providers, etc.)
├── vitest.config.mts               # Test configuration
└── PLAN.md                         # Complete architectural design masterplan
```

---

## Getting Started

### Prerequisites

- **Node.js**: `v20.0.0` or higher (Tested on `v24.x`)
- **Yarn**: `1.22.x` or higher
- **Redis** _(Optional for local dev)_: Runs in degraded in-memory mode if Redis is offline.

### 1. Installation

```bash
yarn install
```

### 2. Environment Setup

Copy the example environment file and customize values as needed:

```bash
cp .env.example .env
```

### 3. Running the Server

#### Development (Hot-Reloading)

```bash
yarn dev
```

Starts the server at `http://localhost:3000` with instant hot-reloading via `tsx watch`.

#### Production Build & Start

```bash
yarn build
yarn start
```

Compiles TypeScript, transforms path aliases via `tsc-alias`, and starts the production server.

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
	"uptime": 12.4,
	"timestamp": "2026-08-15T16:32:14.256Z"
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
		"example": true,
		"algolia": true,
		"commercetools": true
	},
	"timestamp": "2026-08-15T16:32:14.264Z"
}
```

---

### 2. Product Search

#### GET Search (Simple Query)

```http
GET /v1/search?q=running&page=1&pageSize=10
```

#### POST Search (Advanced AST Filters & Facets)

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

**Response Example (`200 OK`)**:

```json
{
	"success": true,
	"data": {
		"searchId": "42480fb3-2c59-4d9e-bf39-9df9236d98de",
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
			"executionTimeMs": 14,
			"providerExecutionTimeMs": 2,
			"provider": "mock",
			"fallbackTriggered": false
		}
	}
}
```

---

### 3. Tracking & Clickstream Ingestion

```http
POST /v1/track
Content-Type: application/json
x-session-id: sess_client_001

{
  "eventType": "search_result_click",
  "searchId": "42480fb3-2c59-4d9e-bf39-9df9236d98de",
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
		"eventId": "3662b30b-d309-446d-923d-59b7eeb4b81e"
	}
}
```

---

## Adding a New Search Provider

Adding a new provider backend requires zero modifications to existing frontend endpoints:

1. **Add Identifier**: Add the enum value to `src/core/types/provider.types.ts`:
    ```typescript
    export enum SearchProviderId {
    	MY_ENGINE = "my_engine",
    }
    ```
2. **Implement Mapper**: Create `src/infrastructure/providers/my-engine/my-engine.mapper.ts` implementing `toVendorRequest` and `toInternalResponse`.
3. **Subclass `BaseSearchProvider`**:
    ```typescript
    export class MyEngineProvider extends BaseSearchProvider<MyRawReq, MyRawRes> {
      public readonly providerId = SearchProviderId.MY_ENGINE;
      public readonly capabilities = new Set([ProviderCapability.DISJUNCTIVE_FACETING]);

      public mapToVendorRequest(req: SearchRequestDto) { ... }
      public async executeVendorSearch(rawReq: MyRawReq, signal: AbortSignal) { ... }
      public mapToInternalResponse(rawRes: MyRawRes, originalReq: SearchRequestDto, searchId: string, durationMs: number) { ... }
    }
    ```
4. **Register in Container**: Add `providerRegistry.register(new MyEngineProvider(...))` in `src/bootstrap.ts`.

---

## Developer Scripts

| Command             | Action                                                      |
| ------------------- | ----------------------------------------------------------- |
| `yarn dev`          | Start development server with hot-reload via `tsx`          |
| `yarn build`        | Compile TypeScript and resolve path aliases via `tsc-alias` |
| `yarn start`        | Run compiled production server from `dist/index.js`         |
| `yarn test`         | Run Vitest unit and integration test suite                  |
| `yarn test:watch`   | Run Vitest in interactive watch mode                        |
| `yarn typecheck`    | Validate TypeScript types without emitting files            |
| `yarn lint`         | Run oxlint with zero-warning enforcement                    |
| `yarn format`       | Format all source files with Prettier                       |
| `yarn format:check` | Verify Prettier code style compliance                       |

---

## License

MIT
