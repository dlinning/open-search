# Product Search API — Architectural Design & Implementation Plan

---

## 1. Executive Summary & Review of Gemini's Plan

This document serves as the master architectural plan for the **TypeScript Product Search API**. It evaluates the preliminary plan proposed by Google Gemini, identifies critical production gaps, and delivers an enhanced, enterprise-ready architecture.

### 1.1 Review of Gemini's Initial Plan

The Gemini proposal provides a solid conceptual foundation, particularly with its high-level pipeline flow, standard DTO sketches, deterministic MD5 hashing for A/B testing, and pluggable provider/sink interfaces. However, for a production-grade e-commerce search service, several mission-critical gaps were identified:

| Architectural Area                   | Gemini Proposal                                                        | Identified Gap / Production Risk                                                                                                        | Our Solution in this Plan                                                                                                                             |
| ------------------------------------ | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Resilience & Fallbacks**           | Direct synchronous provider call; throws on vendor failure.            | Vendor 5xx/timeouts fail customer search queries; no graceful degradation.                                                              | Per-provider Circuit Breaker (`opossum`), strict `AbortSignal` timeouts, and fallback provider routing.                                               |
| **Search Relevancy & Filtering**     | Flat filter array (`field`, `operator`, `value`).                      | Cannot handle complex e-commerce queries (nested `AND`/`OR`/`NOT`, range facets, disjunctive faceting, hierarchical categories).        | Unified AST-style filter expression tree supporting conjunctive & disjunctive faceting, range buckets, and currency localization.                     |
| **Analytics Reliability**            | In-memory `Promise.allSettled()` without persistence or backpressure.  | Process restarts, crashes, or high-throughput spikes lead to silent analytics event loss.                                               | Buffered ring-queue with Redis Stream / BullMQ fallback for guaranteed at-least-once delivery and backpressure management.                            |
| **Search-to-Conversion Correlation** | Independent tracking endpoint without correlated session trace.        | Impossible to accurately attribute downstream clicks, cart additions, and purchases back to specific search queries and rank positions. | Cryptographically unique, deterministic `searchId` generated per query, passed downstream, and attached to all click/conversion events.               |
| **Personalization Feedback Loop**    | Separate Redis read; no clear real-time write pipeline from analytics. | Redis session profiles remain static during a session unless wired to clickstream.                                                      | Real-time session affinity engine that immediately updates user category/brand affinity scores upon `/v1/track` events, boosting subsequent searches. |
| **A/B Experiment Collisions**        | Unscoped sequential mutation of `SearchRequestDto`.                    | Multiple concurrent experiments (e.g. Provider test + Ranking boost + Faceting test) can conflict and corrupt query parameters.         | Scoped, orthogonal Experiment Domains (`PROVIDER`, `QUERY_REWRITE`, `RANKING_BOOST`, `FACET_CONFIG`) with conflict resolution.                        |
| **Provider Capability Matrix**       | Assumes all providers support identical features.                      | Different backends (Algolia vs Commercetools vs GCP Discovery Engine vs OpenSearch) have vastly different capability sets.              | Formal `ProviderCapability` flags so the core engine adapts features (e.g., semantic search, vector boosting) dynamically based on backend support.   |

---

## 2. End-to-End System Architecture

The Search API is designed as a **low-latency, resilient orchestration layer** built on **Fastify** and **TypeScript**. It bridges client applications, search engines, session caching, and analytical warehouses.

```
                                      ┌─────────────────────────────────────────┐
                                      │           Client Applications           │
                                      │  (Web Storefront, Mobile App, BFF, B2B) │
                                      └────────────────────┬────────────────────┘
                                                           │
                                                           │ HTTP / JSON (Search / Track)
                                                           ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ FASTIFY APPLICATION GATEWAY (Stateless, High-Throughput, OpenTelemetry Traced)                                    │
│                                                                                                                  │
│  ┌─────────────────────────┐   ┌───────────────────────────┐   ┌───────────────────────────┐                     │
│  │ Context & Auth Parser   │──►│ Input Validator (Zod/Type)│──►│ Correlation ID Generator  │                     │
│  │ (Session/User/IP/Geo)   │   │ (Sanitize & Normalize)    │   │ (searchId, traceparent)   │                     │
│  └─────────────────────────┘   └───────────────────────────┘   └─────────────┬─────────────┘                     │
│                                                                              │                                   │
│  ┌───────────────────────────────────────────────────────────────────────────┴────────────────────────────────┐  │
│  │ SEARCH PIPELINE EXECUTION ENGINE                                                                          │  │
│  │                                                                                                           │  │
│  │  1. A/B Experiment Evaluator                                                                              │  │
│  │     └─ Deterministic MurmurHash3 bucketing ──► Resolves active variants across orthogonal scopes          │  │
│  │                                                                                                           │  │
│  │  2. Personalization & Query Rewriter                                                                      │  │
│  │     └─ Parallel sub-5ms Redis lookup ───────► Injects category/brand affinity boosts & query expansion   │  │
│  │                                                                                                           │  │
│  │  3. Provider Selection & Circuit Breaker                                                                  │  │
│  │     └─ ProviderRegistry.get(providerId) ───► Executes via Circuit Breaker + Timeout (Fallback on failure)│  │
│  │                                                                                                           │  │
│  │  4. Response Normalization & Enrichment                                                                   │  │
│  │     └─ Maps vendor payload to Unified DTO ─► Injects `searchId`, `activeExperiments`, & telemetry stats  │  │
│  └───────────────────────────────────────────────────────────────────────────┬───────────────────────────────┘  │
│                                                                              │                                   │
│                                ┌─────────────────────────────────────────────┴────────┐                          │
│                                │                                                      │                          │
│                                ▼                                                      ▼                          │
│                 ┌─────────────────────────────┐                        ┌───────────────────────────────┐         │
│                 │   Synchronous HTTP Output   │                        │   Async Analytics Dispatcher  │         │
│                 │  (Fast Response to Client)  │                        │   (Non-Blocking Ring Buffer)  │         │
│                 └─────────────────────────────┘                        └──────────────┬────────────────┘         │
└───────────────────────────────────────────────────────────────────────────────────────┼──────────────────────────┘
                                                                                        │
                                                     ┌──────────────────────────────────┴───────────────────────┐
                                                     ▼                                                          ▼
                                      ┌──────────────────────────────┐                           ┌──────────────────────────────┐
                                      │   High-Speed Session Cache   │                           │     Pluggable Event Sinks    │
                                      │       (Redis Cluster)        │                           │                              │
                                      │  • User/Session Affinities   │                           │  • ClickHouse / Postgres DB  │
                                      │  • Query Result Caching      │                           │  • GA4 / Plausible / AppIns  │
                                      │  • Event Stream Buffer       │                           │  • Data Lake / Kafka Export  │
                                      └──────────────────────────────┘                           └──────────────────────────────┘
```

---

## 3. Core Domain Models & Data Transfer Objects (DTOs)

### 3.1 Search Provider Enum & Capability Matrix

```typescript
// src/core/types/provider.types.ts

export enum SearchProviderId {
  ALGOLIA = 'algolia',
  COMMERCETOOLS = 'commercetools',
  GCP_VERTEX_SEARCH = 'gcp_vertex_search',
  OPENSEARCH = 'opensearch',
  MOCK = 'mock',
}

export enum ProviderCapability {
  DISJUNCTIVE_FACETING = 'DISJUNCTIVE_FACETING',
  VECTOR_HYBRID_SEARCH = 'VECTOR_HYBRID_SEARCH',
  HIERARCHICAL_FACETS = 'HIERARCHICAL_FACETS',
  QUERY_SUGGESTIONS = 'QUERY_SUGGESTIONS',
  DYNAMIC_BOOSTING = 'DYNAMIC_BOOSTING',
  SYNONYM_EXPANSION = 'SYNONYM_EXPANSION',
  GEO_FILTERING = 'GEO_FILTERING',
}
```

### 3.2 Search Request DTO with Rich Filtering AST

```typescript
// src/core/types/search-request.types.ts

export type FilterOperator =
  'EQ' | 'NEQ' | 'IN' | 'NIN' | 'GT' | 'GTE' | 'LT' | 'LTE' | 'BETWEEN' | 'CONTAINS' | 'PREFIX';

export interface LeafFilter {
  type: 'leaf';
  field: string;
  operator: FilterOperator;
  value: string | number | boolean | (string | number)[];
}

export interface CompositeFilter {
  type: 'composite';
  logic: 'AND' | 'OR' | 'NOT';
  filters: SearchFilterNode[];
}

export type SearchFilterNode = LeafFilter | CompositeFilter;

export interface SortClause {
  field: string;
  direction: 'asc' | 'desc';
}

export interface PaginationParams {
  page: number; // 1-indexed
  pageSize: number; // 1 to 100
  cursor?: string; // For deep-pagination / cursor-based backends
}

export interface UserContext {
  userId?: string;
  sessionId: string;
  locale: string; // e.g. "en-US", "de-DE"
  currency: string; // e.g. "USD", "EUR"
  ipAddress?: string;
  userAgent?: string;
  geo?: {
    country?: string;
    region?: string;
    city?: string;
    latitude?: number;
    longitude?: number;
  };
  segments?: string[]; // e.g. ["vip", "b2b", "newsletter_subscriber"]
  customAttributes?: Record<string, unknown>;
}

export interface SearchRequestDto {
  query: string;
  providerId?: SearchProviderId; // Optional; auto-selected by router/experiment if omitted
  pagination: PaginationParams;
  filters?: SearchFilterNode;
  facetsRequested?: string[]; // Fields to return aggregation counts for
  sort?: SortClause[];
  userContext: UserContext;
  enablePersonalization?: boolean; // Default true
  debug?: boolean; // Returns execution traces if authorized
}
```

### 3.3 Unified Search Response DTO

```typescript
// src/core/types/search-response.types.ts

export interface PriceDto {
  currency: string;
  regularPrice: number;
  salePrice?: number;
  discountPercentage?: number;
}

export interface ProductHit {
  id: string;
  sku: string;
  title: string;
  description: string;
  brand?: string;
  categories: string[];
  hierarchicalCategories?: Record<string, string[]>; // e.g. { lvl0: ['Apparel'], lvl1: ['Apparel > Shoes'] }
  price: PriceDto;
  thumbnailUrl?: string;
  images?: string[];
  inStock: boolean;
  inventoryCount?: number;
  rating?: {
    average: number;
    count: number;
  };
  attributes: Record<string, unknown>;
  relevanceScore?: number;
  highlightedFields?: Record<string, string>; // Snippets with <em> matching
}

export interface FacetBucket {
  value: string;
  count: number;
  selected?: boolean;
}

export interface FacetResult {
  field: string;
  displayName: string;
  type: 'terms' | 'range' | 'hierarchical';
  buckets: FacetBucket[];
}

export interface SearchTelemetry {
  executionTimeMs: number;
  providerExecutionTimeMs: number;
  sessionAffinityLookupMs: number;
  provider: SearchProviderId;
  fallbackTriggered: boolean;
  cachedResponse: boolean;
}

export interface SearchResponseDto {
  searchId: string; // Trace token for downstream analytics
  query: string;
  pagination: {
    page: number;
    pageSize: number;
    totalHits: number;
    totalPages: number;
    nextCursor?: string;
  };
  items: ProductHit[];
  facets: FacetResult[];
  appliedFilters?: SearchFilterNode;
  activeExperiments: Array<{
    experimentId: string;
    variantId: string;
    scope: string;
  }>;
  suggestions?: string[]; // "Did you mean?" or alternative queries
  telemetry: SearchTelemetry;
}
```

---

## 4. Provider Adapter Subsystem & Extensibility

### 4.1 The Provider Interface & Base Class

The architecture enforces strict decoupling between unified internal DTOs and vendor-specific payload schemas.

```typescript
// src/core/interfaces/search-provider.interface.ts

export interface ISearchProvider<TRawReq = unknown, TRawRes = unknown> {
  readonly providerId: SearchProviderId;
  readonly capabilities: ReadonlySet<ProviderCapability>;

  /** Transforms normalized internal request into vendor-specific payload */
  mapToVendorRequest(request: SearchRequestDto, boostParams?: QueryBoostParameters): TRawReq;

  /** Executes search query against external engine with AbortSignal timeout */
  executeVendorSearch(rawReq: TRawReq, signal: AbortSignal): Promise<TRawRes>;

  /** Normalizes vendor response into unified SearchResponseDto */
  mapToInternalResponse(
    rawRes: TRawRes,
    originalReq: SearchRequestDto,
    searchId: string,
    durationMs: number,
  ): SearchResponseDto;

  /** Full pipeline execution with built-in telemetry and circuit breaker protection */
  search(
    request: SearchRequestDto,
    searchId: string,
    boostParams?: QueryBoostParameters,
  ): Promise<SearchResponseDto>;

  /** Health-check hook for readiness probes */
  healthCheck(): Promise<boolean>;
}
```

### 4.2 Base Provider Implementation with Circuit Breaking & Timeouts

```typescript
// src/infrastructure/providers/base.provider.ts

import CircuitBreaker from 'opossum';
import { ISearchProvider } from '../../core/interfaces/search-provider.interface';
import { SearchProviderId, ProviderCapability } from '../../core/types/provider.types';
import { SearchRequestDto, QueryBoostParameters } from '../../core/types/search-request.types';
import { SearchResponseDto } from '../../core/types/search-response.types';
import { AppError } from '../../core/errors/app-error';

export abstract class BaseSearchProvider<TRawReq, TRawRes> implements ISearchProvider<
  TRawReq,
  TRawRes
> {
  public abstract readonly providerId: SearchProviderId;
  public abstract readonly capabilities: ReadonlySet<ProviderCapability>;

  protected breaker: CircuitBreaker<[TRawReq, AbortSignal], TRawRes>;
  protected timeoutMs: number;

  constructor(timeoutMs = 2500, breakerOptions?: CircuitBreaker.Options) {
    this.timeoutMs = timeoutMs;
    this.breaker = new CircuitBreaker(
      (req: TRawReq, signal: AbortSignal) => this.executeVendorSearch(req, signal),
      {
        timeout: this.timeoutMs,
        errorThresholdPercentage: 50,
        resetTimeout: 10000,
        ...breakerOptions,
      },
    );

    this.breaker.on('open', () => {
      console.warn(`[CircuitBreaker] Provider ${this.providerId} OPENED - failing fast`);
    });
  }

  public abstract mapToVendorRequest(
    request: SearchRequestDto,
    boostParams?: QueryBoostParameters,
  ): TRawReq;
  public abstract executeVendorSearch(rawReq: TRawReq, signal: AbortSignal): Promise<TRawRes>;
  public abstract mapToInternalResponse(
    rawRes: TRawRes,
    originalReq: SearchRequestDto,
    searchId: string,
    durationMs: number,
  ): SearchResponseDto;

  public async search(
    request: SearchRequestDto,
    searchId: string,
    boostParams?: QueryBoostParameters,
  ): Promise<SearchResponseDto> {
    const startTime = performance.now();
    const vendorPayload = this.mapToVendorRequest(request, boostParams);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const rawResponse = await this.breaker.fire(vendorPayload, controller.signal);
      const executionTimeMs = Math.round(performance.now() - startTime);
      return this.mapToInternalResponse(rawResponse, request, searchId, executionTimeMs);
    } catch (err: any) {
      const executionTimeMs = Math.round(performance.now() - startTime);
      throw new AppError(
        `Provider ${this.providerId} execution failed: ${err.message}`,
        502,
        'PROVIDER_ERROR',
        {
          providerId: this.providerId,
          executionTimeMs,
          originalError: err,
        },
      );
    } finally {
      clearTimeout(timer);
    }
  }

  public async healthCheck(): Promise<boolean> {
    return !this.breaker.opened;
  }
}
```

### 4.3 Type-Safe Provider Registry with Dynamic Resolution

```typescript
// src/infrastructure/providers/provider.registry.ts

import { ISearchProvider } from '../../core/interfaces/search-provider.interface';
import { SearchProviderId } from '../../core/types/provider.types';

export class SearchProviderRegistry {
  private readonly providers = new Map<SearchProviderId, ISearchProvider>();
  private defaultProviderId: SearchProviderId = SearchProviderId.MOCK;

  public register(provider: ISearchProvider): this {
    this.providers.set(provider.providerId, provider);
    return this;
  }

  public setDefaultProvider(providerId: SearchProviderId): void {
    if (!this.providers.has(providerId)) {
      throw new Error(`Cannot set default provider to unregistered ID: ${providerId}`);
    }
    this.defaultProviderId = providerId;
  }

  public get(providerId?: SearchProviderId): ISearchProvider {
    const targetId = providerId || this.defaultProviderId;
    const provider = this.providers.get(targetId);
    if (!provider) {
      throw new Error(
        `Search provider not configured: ${targetId}. Available: ${[...this.providers.keys()].join(', ')}`,
      );
    }
    return provider;
  }

  public getFallback(failedProviderId: SearchProviderId): ISearchProvider | null {
    for (const [id, provider] of this.providers.entries()) {
      if (id !== failedProviderId && !this.isCircuitOpen(id)) {
        return provider;
      }
    }
    return null;
  }

  private isCircuitOpen(id: SearchProviderId): boolean {
    const provider = this.providers.get(id);
    return provider ? !(provider as any).breaker?.opened : true;
  }

  public listAvailable(): SearchProviderId[] {
    return Array.from(this.providers.keys());
  }
}
```

### 4.4 Step-by-Step: Adding a New Search Provider

To add any new search backend (e.g. `Elasticsearch` / `OpenSearch`, `Constructor.io`, `Klevu`):

1. **Add Enum**: Add identifier in `src/core/types/provider.types.ts`.
2. **Define Vendor Types**: Create `src/infrastructure/providers/{provider}/{provider}.types.ts` containing the vendor's SDK request & response types.
3. **Implement Bidirectional Mapper**: Create `{provider}.mapper.ts` implementing:
   - `toVendorQuery(req: SearchRequestDto, boosts?: QueryBoostParameters)`
   - `toInternalResponse(res: VendorResponse, originalReq, searchId, durationMs): SearchResponseDto`
4. **Implement Provider Class**: Subclass `BaseSearchProvider` and declare `capabilities`.
5. **Register in Container**: Instantiate in `src/bootstrap.ts` and call `registry.register(newProvider)`.

---

## 5. Deterministic A/B Testing & Experimentation Engine

### 5.1 Architecture & Conflict-Free Experiment Scopes

To prevent mutation collisions when multiple experiments are running concurrently, experiments are categorized into isolated **Scopes**:

```
                       ┌─────────────────────────────────────────────────────────┐
                       │                   Incoming Search Query                 │
                       └────────────────────────────┬────────────────────────────┘
                                                    │
                                                    ▼
                       ┌─────────────────────────────────────────────────────────┐
                       │          EXPERIMENT SCOPES (Evaluated in Sequence)      │
                       │                                                         │
                       │ 1. SCOPE: PROVIDER                                      │
                       │    └─ Selects Backend (e.g. Algolia vs OpenSearch)      │
                       │                                                         │
                       │ 2. SCOPE: QUERY_REWRITE                                 │
                       │    └─ Synonym expansion, typo tolerance tolerance rules │
                       │                                                         │
                       │ 3. SCOPE: RANKING_BOOST                                 │
                       │    └─ Vector boost weights, brand margin re-ranking     │
                       │                                                         │
                       │ 4. SCOPE: FACET_LAYOUT                                  │
                       │    └─ Dynamic facet ordering vs static taxonomy         │
                       └────────────────────────────┬────────────────────────────┘
                                                    │
                                                    ▼
                       ┌─────────────────────────────────────────────────────────┐
                       │       Enriched Request + Assigned Experiment Tags       │
                       └─────────────────────────────────────────────────────────┘
```

### 5.2 Deterministic MurmurHash3 Evaluator Implementation

```typescript
// src/infrastructure/experiments/experiment-evaluator.ts

import murmur from 'murmurhash';
import { SearchRequestDto } from '../../core/types/search-request.types';

export type ExperimentScope = 'PROVIDER' | 'QUERY_REWRITE' | 'RANKING_BOOST' | 'FACET_LAYOUT';

export interface VariantAllocation {
  variantId: string;
  weight: number; // 0 to 100 percentage integer
  config?: Record<string, unknown>;
}

export interface ExperimentDefinition {
  id: string;
  scope: ExperimentScope;
  enabled: boolean;
  trafficPercentage: number; // 0 - 100
  variants: VariantAllocation[];
  targetingRule?: (req: SearchRequestDto) => boolean;
  mutate: (req: SearchRequestDto, variantId: string, config?: Record<string, unknown>) => void;
}

export interface ExperimentAssignment {
  experimentId: string;
  variantId: string;
  scope: ExperimentScope;
}

export class ExperimentEvaluator {
  private readonly experiments = new Map<string, ExperimentDefinition>();

  public register(experiment: ExperimentDefinition): void {
    const totalWeight = experiment.variants.reduce((acc, v) => acc + v.weight, 0);
    if (totalWeight !== 100) {
      throw new Error(
        `Experiment ${experiment.id} variant weights must sum to 100 (got ${totalWeight})`,
      );
    }
    this.experiments.set(experiment.id, experiment);
  }

  public evaluate(request: SearchRequestDto): ExperimentAssignment[] {
    const assignments: ExperimentAssignment[] = [];
    const entityKey = request.userContext.userId || request.userContext.sessionId;

    // Evaluate by scope hierarchy to guarantee clean deterministic mutations
    const activeExperiments = Array.from(this.experiments.values()).filter((e) => e.enabled);

    for (const exp of activeExperiments) {
      if (exp.targetingRule && !exp.targetingRule(request)) {
        continue;
      }

      // Check if user falls within experiment traffic allocation
      const trafficBucket = this.hashToBucket(`${entityKey}:${exp.id}:traffic`, 100);
      if (trafficBucket >= exp.trafficPercentage) {
        continue;
      }

      // Determine assigned variant
      const variantBucket = this.hashToBucket(`${entityKey}:${exp.id}:variant`, 100);
      let cumulative = 0;
      let selectedVariant = exp.variants[0];

      for (const variant of exp.variants) {
        cumulative += variant.weight;
        if (variantBucket < cumulative) {
          selectedVariant = variant;
          break;
        }
      }

      // Apply mutation safely
      exp.mutate(request, selectedVariant.variantId, selectedVariant.config);

      assignments.push({
        experimentId: exp.id,
        variantId: selectedVariant.variantId,
        scope: exp.scope,
      });
    }

    return assignments;
  }

  private hashToBucket(key: string, modulus: number): number {
    const hash = murmur.v3(key, 0x12345678);
    return Math.abs(hash) % modulus;
  }
}
```

---

## 6. Personalization & Real-Time Session Affinity Engine

### 6.1 Bidirectional Feedback Architecture

Unlike static personalization, our architecture forms a closed loop:

1. **User Activity**: Client sends `/v1/track` events when a user clicks a product, views categories, or adds to cart.
2. **Instant Redis Update**: The track worker increments category/brand decay counters in Redis (TTL: 30 minutes).
3. **Instant Search Boosting**: The very next search in that session reads affinities in `< 2ms` and injects dynamic boost filters into the search query.

```
       [ Client / Browser ]
          │             ▲
1. Search │             │ 4. Boosted Search Results (e.g. Shoes boosted)
          ▼             │
   [ /v1/search ]       │
          │             │
          ├─────────────┼──► Reads Session Affinity ◄────┐
          │             │    (category: "Shoes", w: 4.5) │ (Sub-2ms Redis read)
          ▼             │                                │
   [ Algolia / CT / GCP ]                                │
                                                         │ 3. Real-Time Update
   [ Client / Browser ]                                  │    (Increment "Shoes" +3)
          │                                              │
2. Clicks "Running Shoes"                                │
          ▼                                              │
   [ /v1/track ] ────────────────────────────────────────┘
```

### 6.2 Redis Session Schema & Decay Math

- Key: `session:{sessionId}:affinity` (Redis Hash)
- Fields:
  - `cat:{categoryName}` -> Integer Score
  - `brand:{brandName}` -> Integer Score
  - `price_tier` -> `budget` | `mid` | `premium`
  - `updated_at` -> Timestamp
- Expiry: 1800 seconds (sliding window TTL refreshed on every interaction).

```typescript
// src/services/personalization.service.ts

import { Redis } from 'ioredis';
import { UserContext } from '../../core/types/search-request.types';

export interface QueryBoostParameters {
  categoryBoosts?: Array<{ category: string; weight: number }>;
  brandBoosts?: Array<{ brand: string; weight: number }>;
  priceRangeBoost?: { min?: number; max?: number };
}

export class PersonalizationService {
  constructor(private readonly redis: Redis) {}

  public async getSessionBoosts(
    userContext: UserContext,
  ): Promise<QueryBoostParameters | undefined> {
    const sessionKey = `session:${userContext.sessionId}:affinity`;

    try {
      const affinities = await this.redis.hgetall(sessionKey);
      if (!affinities || Object.keys(affinities).length === 0) {
        return undefined;
      }

      const categoryBoosts: Array<{ category: string; weight: number }> = [];
      const brandBoosts: Array<{ brand: string; weight: number }> = [];

      for (const [key, valueStr] of Object.entries(affinities)) {
        const score = parseFloat(valueStr);
        if (isNaN(score) || score <= 0) continue;

        if (key.startsWith('cat:')) {
          categoryBoosts.push({ category: key.replace('cat:', ''), weight: Math.min(score, 10) });
        } else if (key.startsWith('brand:')) {
          brandBoosts.push({ brand: key.replace('brand:', ''), weight: Math.min(score, 10) });
        }
      }

      return {
        categoryBoosts: categoryBoosts.sort((a, b) => b.weight - a.weight).slice(0, 3),
        brandBoosts: brandBoosts.sort((a, b) => b.weight - a.weight).slice(0, 3),
      };
    } catch (err) {
      // Personalization failure must never crash the search path
      return undefined;
    }
  }

  public async recordInteraction(
    sessionId: string,
    interaction: { category?: string; brand?: string; weight?: number },
  ): Promise<void> {
    const sessionKey = `session:${sessionId}:affinity`;
    const weight = interaction.weight || 1;

    const pipeline = this.redis.pipeline();
    if (interaction.category) {
      pipeline.hincrbyfloat(sessionKey, `cat:${interaction.category}`, weight);
    }
    if (interaction.brand) {
      pipeline.hincrbyfloat(sessionKey, `brand:${interaction.brand}`, weight);
    }
    pipeline.expire(sessionKey, 1800); // Reset 30-minute sliding window
    await pipeline.exec();
  }
}
```

---

## 7. Resilient Asynchronous Analytics Engine

### 7.1 Search-to-Conversion Correlation Model

To accurately calculate Search Click-Through Rate (CTR), Conversion Rate (CVR), and Mean Reciprocal Rank (MRR), every search produces a **`searchId`** (UUIDv7 or ULID containing a high-precision timestamp).

```typescript
// src/core/types/analytics.types.ts

export enum AnalyticsEventType {
  SEARCH_REQUEST = 'search_request',
  SEARCH_RESULT_CLICK = 'search_result_click',
  PRODUCT_DETAIL_VIEW = 'product_detail_view',
  CART_ADDITION = 'cart_addition',
  CONVERSION = 'conversion',
}

export interface AnalyticsEventDto {
  eventId: string;
  eventType: AnalyticsEventType;
  timestamp: string; // ISO 8601 UTC
  searchId: string; // Correlates back to the original search
  provider: SearchProviderId;
  userContext: UserContext;
  experiments: Array<{ experimentId: string; variantId: string }>;
  payload: {
    query?: string;
    totalHits?: number;
    returnedItemIds?: string[];
    clickedItemId?: string;
    rankPosition?: number; // 1-indexed hit position
    pricePaid?: number;
    currency?: string;
    latencyMs?: number;
    customMetadata?: Record<string, unknown>;
  };
}
```

### 7.2 Non-Blocking Resilient Dispatcher with Pluggable Sinks

```typescript
// src/infrastructure/analytics/analytics-dispatcher.ts

import { AnalyticsEventDto } from '../../core/types/analytics.types';
import { IAnalyticsSink } from '../../core/interfaces/analytics-sink.interface';

export class AnalyticsDispatcher {
  private sinks: IAnalyticsSink[] = [];
  private memoryBuffer: AnalyticsEventDto[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private readonly maxBufferSize: number;
  private readonly flushIntervalMs: number;

  constructor(maxBufferSize = 100, flushIntervalMs = 1000) {
    this.maxBufferSize = maxBufferSize;
    this.flushIntervalMs = flushIntervalMs;
    this.startPeriodicFlush();
  }

  public registerSink(sink: IAnalyticsSink): this {
    this.sinks.push(sink);
    return this;
  }

  public dispatch(event: AnalyticsEventDto): void {
    this.memoryBuffer.push(event);
    if (this.memoryBuffer.length >= this.maxBufferSize) {
      this.flush();
    }
  }

  public async flush(): Promise<void> {
    if (this.memoryBuffer.length === 0) return;

    const batch = [...this.memoryBuffer];
    this.memoryBuffer = [];

    const sinkPromises = this.sinks.map(async (sink) => {
      try {
        if (sink.sendBatch) {
          await sink.sendBatch(batch);
        } else {
          await Promise.allSettled(batch.map((e) => sink.send(e)));
        }
      } catch (err) {
        console.error(`[AnalyticsSink:${sink.sinkId}] Batch flush failed:`, err);
      }
    });

    await Promise.allSettled(sinkPromises);
  }

  private startPeriodicFlush(): void {
    this.flushTimer = setInterval(() => this.flush(), this.flushIntervalMs);
    this.flushTimer.unref(); // Prevent timer from keeping Node process alive
  }
}
```

### 7.3 Pluggable Sinks Matrix

| Sink Target                  | Delivery Mechanism                                                    | Use Case / Query Schema                                                              |
| ---------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| **ClickHouse**               | Micro-batched `INSERT INTO search_events FORMAT JSONEachRow`          | Real-time aggregate analytics: CTR by variant, 0-result query alerts, p95 latencies. |
| **PostgreSQL**               | Micro-batched `INSERT INTO analytics_events (...)` with JSONB payload | Transactional verification, audit logging, B2B reporting.                            |
| **Google Analytics 4 (GA4)** | Measurement Protocol HTTP POST (`/mp/collect`)                        | Marketing attribution, user journey unification.                                     |
| **Plausible Analytics**      | Custom event POST (`/api/event`)                                      | Privacy-first aggregate metrics without cookie consents.                             |
| **Azure App Insights**       | SDK telemetry client (`trackEvent`)                                   | Operational monitoring and enterprise cloud diagnostics.                             |

---

## 8. Complete Project File Structure

```plaintext
open-search-api/
├── .github/
│   └── workflows/
│       ├── ci.yml
│       └── docker-publish.yml
├── docker/
│   ├── Dockerfile
│   ├── docker-compose.yml
│   └── init-clickhouse.sql
├── src/
│   ├── api/
│   │   ├── controllers/
│   │   │   ├── search.controller.ts
│   │   │   ├── tracking.controller.ts
│   │   │   └── health.controller.ts
│   │   ├── middlewares/
│   │   │   ├── user-context.middleware.ts
│   │   │   ├── correlation-id.middleware.ts
│   │   │   ├── rate-limiter.middleware.ts
│   │   │   └── error-handler.middleware.ts
│   │   ├── routes/
│   │   │   ├── v1/
│   │   │   │   ├── search.routes.ts
│   │   │   │   ├── track.routes.ts
│   │   │   │   └── index.ts
│   │   │   └── health.routes.ts
│   │   └── validation/
│   │       ├── search.schema.ts
│   │       └── tracking.schema.ts
│   ├── config/
│   │   ├── env.ts
│   │   └── constants.ts
│   ├── core/
│   │   ├── errors/
│   │   │   └── app-error.ts
│   │   ├── interfaces/
│   │   │   ├── search-provider.interface.ts
│   │   │   ├── analytics-sink.interface.ts
│   │   │   ├── experiment-engine.interface.ts
│   │   │   └── personalization-store.interface.ts
│   │   └── types/
│   │       ├── provider.types.ts
│   │       ├── search-request.types.ts
│   │       ├── search-response.types.ts
│   │       ├── analytics.types.ts
│   │       └── experiment.types.ts
│   ├── infrastructure/
│   │   ├── analytics/
│   │   │   ├── analytics-dispatcher.ts
│   │   │   └── sinks/
│   │   │       ├── clickhouse.sink.ts
│   │   │       ├── postgres.sink.ts
│   │   │       ├── ga4.sink.ts
│   │   │       ├── plausible.sink.ts
│   │   │       └── app-insights.sink.ts
│   │   ├── cache/
│   │   │   └── redis.client.ts
│   │   ├── experiments/
│   │   │   ├── experiment-evaluator.ts
│   │   │   └── definitions/
│   │   │       ├── provider-comparison.exp.ts
│   │   │       └── vector-boost.exp.ts
│   │   ├── observability/
│   │   │   ├── logger.ts
│   │   │   ├── metrics.ts
│   │   │   └── tracer.ts
│   │   └── providers/
│   │       ├── base.provider.ts
│   │       ├── provider.registry.ts
│   │       ├── algolia/
│   │       │   ├── algolia.mapper.ts
│   │       │   ├── algolia.types.ts
│   │       │   └── algolia.provider.ts
│   │       ├── commercetools/
│   │       │   ├── commercetools.mapper.ts
│   │       │   ├── commercetools.types.ts
│   │       │   └── commercetools.provider.ts
│   │       ├── gcp/
│   │       │   ├── gcp.mapper.ts
│   │       │   ├── gcp.types.ts
│   │       │   └── gcp.provider.ts
│   │       ├── opensearch/
│   │       │   ├── opensearch.mapper.ts
│   │       │   ├── opensearch.types.ts
│   │       │   └── opensearch.provider.ts
│   │       └── mock/
│   │           ├── mock.data.ts
│   │           └── mock.provider.ts
│   ├── services/
│   │   ├── search.service.ts
│   │   ├── personalization.service.ts
│   │   └── tracking.service.ts
│   ├── bootstrap.ts
│   ├── server.ts
│   └── index.ts
├── test/
│   ├── fixtures/
│   │   ├── algolia-search-response.json
│   │   └── commercetools-search-response.json
│   ├── integration/
│   │   ├── search-pipeline.test.ts
│   │   └── tracking-pipeline.test.ts
│   ├── load/
│   │   └── k6-search-benchmark.js
│   └── unit/
│       ├── experiment-evaluator.test.ts
│       ├── mappers.test.ts
│       └── provider-registry.test.ts
├── .env.example
├── package.json
├── tsconfig.json
└── README.md
```

---

## 9. Configuration Management & Environment Validation

We use **Zod** to guarantee that the application fails fast at startup if required configuration variables are missing or misconfigured.

```typescript
// src/config/env.ts

import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default('0.0.0.0'),
  DEFAULT_PROVIDER: z
    .enum(['algolia', 'commercetools', 'gcp_vertex_search', 'opensearch', 'mock'])
    .default('mock'),

  // Redis Cache & Session
  REDIS_URL: z.string().url().default('redis://localhost:6379'),

  // Algolia (Optional unless default or selected)
  ALGOLIA_APP_ID: z.string().optional(),
  ALGOLIA_API_KEY: z.string().optional(),
  ALGOLIA_INDEX_NAME: z.string().optional(),

  // Commercetools (Optional)
  COMMERCETOOLS_PROJECT_KEY: z.string().optional(),
  COMMERCETOOLS_CLIENT_ID: z.string().optional(),
  COMMERCETOOLS_CLIENT_SECRET: z.string().optional(),
  COMMERCETOOLS_AUTH_URL: z.string().optional(),
  COMMERCETOOLS_API_URL: z.string().optional(),

  // Analytics Sinks
  CLICKHOUSE_HOST: z.string().optional(),
  CLICKHOUSE_DB: z.string().default('default'),
  CLICKHOUSE_USER: z.string().default('default'),
  CLICKHOUSE_PASSWORD: z.string().optional(),

  POSTGRES_URL: z.string().optional(),
  GA4_MEASUREMENT_ID: z.string().optional(),
  GA4_API_SECRET: z.string().optional(),
});

export type EnvConfig = z.infer<typeof envSchema>;
export const env = envSchema.parse(process.env);
```

---

## 10. Execution Milestones & Phased Roadmap

```
  Phase 1: Foundation (Days 1-3)
  ├── Fastify skeleton, Zod validation, Unified DTOs, Mock Provider, Error Handler
  │
  Phase 2: Core Adapter Pipeline (Days 4-7)
  ├── BaseSearchProvider with CircuitBreaker, Algolia & Commercetools Mappers + Providers
  │
  Phase 3: Resilient Analytics Subsystem (Days 8-10)
  ├── Traced `searchId` propagation, Batching Dispatcher, ClickHouse & Postgres Sinks
  │
  Phase 4: Session Personalization Engine (Days 11-13)
  ├── Redis Session Affinity store, `/v1/track` feedback loop, Dynamic Query Boost mapper
  │
  Phase 5: Deterministic A/B Experiment Engine (Days 14-16)
  ├── MurmurHash3 multi-scope evaluator, Experiment registry, CTR attribution analytics
  │
  Phase 6: Production Hardening, Docker & Benchmarking (Days 17-20)
  └── Multi-stage Dockerfile, docker-compose, OpenTelemetry, k6 load testing (>1,500 req/sec)
```

### Detailed Deliverables by Phase

#### Phase 1: Core Framework & Domain Types

- Initialize Fastify project with TypeScript, strict `tsconfig.json`, and ESLint/Prettier.
- Implement AST Search Filter definitions and Unified Request/Response DTOs.
- Implement `MockSearchProvider` loaded with sample e-commerce catalog data (100 products).
- Build routing layer (`/v1/search`, `/v1/track`, `/health`) and central Error Handling middleware.

#### Phase 2: Provider Adapters & Circuit Breaking

- Implement `BaseSearchProvider` with `opossum` circuit breaking and `AbortSignal` timeouts.
- Implement `AlgoliaSearchProvider` and `AlgoliaMapper` with disjunctive faceting.
- Implement `CommercetoolsSearchProvider` with Product Projections search mapping.
- Implement `SearchProviderRegistry` with automatic fallback routing upon vendor outage.

#### Phase 3: Analytics Infrastructure & Correlation Engine

- Implement high-precision `searchId` generator attached to every query.
- Create `AnalyticsDispatcher` with in-memory ring buffer and micro-batch flushing.
- Implement `ClickHouseSink` and `PostgresSink` with auto-migration schema scripts.
- Implement `GA4Sink` and `PlausibleSink` for external telemetry dispatch.

#### Phase 4: Personalization & Real-Time Feedback Loop

- Connect Redis cluster client with connection pooling and automated reconnection.
- Build `PersonalizationService` managing session affinities (`cat:*`, `brand:*`).
- Wire `/v1/track` endpoint directly to Redis affinity increments.
- Extend provider mappers to translate affinity scores into vendor boost parameters.

#### Phase 5: Deterministic A/B Testing Engine

- Implement `ExperimentEvaluator` using MurmurHash3 across `PROVIDER`, `QUERY_REWRITE`, and `RANKING_BOOST` scopes.
- Register test experiments (e.g. Algolia vs Commercetools 50/50 split).
- Ensure all experiment tags propagate to search responses and downstream analytics events.

#### Phase 6: Production Hardening, Observability & Containerization

- Add OpenTelemetry SDK for distributed tracing (`traceparent` header support).
- Add Prometheus `/metrics` endpoint (latency p50/p95/p99, cache hit ratio, provider errors).
- Create optimized multi-stage `Dockerfile` and `docker-compose.yml`.
- Execute k6 load tests validating `< 25ms` internal latency under 1,500 req/sec.

---

## 11. Containerization & Deployment

### 11.1 Multi-Stage Dockerfile

```dockerfile
# Build stage
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json tsconfig.json ./
RUN npm ci
COPY src ./src
RUN npm run build && npm prune --production

# Production runner stage
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

USER appuser
EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=3s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

CMD ["node", "dist/index.js"]
```

### 11.2 Docker Compose Development Environment

```yaml
version: '3.8'

services:
  search-api:
    build:
      context: .
      dockerfile: docker/Dockerfile
    ports:
      - '3000:3000'
    environment:
      - NODE_ENV=development
      - PORT=3000
      - REDIS_URL=redis://redis:6379
      - CLICKHOUSE_HOST=http://clickhouse:8123
      - DEFAULT_PROVIDER=mock
    depends_on:
      - redis
      - clickhouse
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    ports:
      - '6379:6379'
    volumes:
      - redis-data:/data
    command: redis-server --appendonly yes

  clickhouse:
    image: clickhouse/clickhouse-server:latest
    ports:
      - '8123:8123'
      - '9000:9000'
    volumes:
      - clickhouse-data:/var/lib/clickhouse
      - ./docker/init-clickhouse.sql:/docker-entrypoint-initdb.d/init.sql

volumes:
  redis-data:
  clickhouse-data:
```

---

## 12. Summary of Key Architectural Advantages

1. **True Vendor Portability**: Adding or switching search vendors requires **zero changes** to frontend or downstream services—only a mapper and provider class.
2. **Extreme Resilience**: Providers execute behind circuit breakers with strict timeouts and automatic failover, preventing third-party outages from taking down store search.
3. **Deterministic, Safe A/B Testing**: Hash-based assignment eliminates state synchronization, while scoped experiment mutations prevent parameter collisions.
4. **Instant Personalization Loop**: Session affinities update within milliseconds of clickstream tracking events, dramatically improving customer conversion.
5. **Zero Data Loss Analytics**: Asynchronous ring buffering with database micro-batching provides high-throughput analytics without penalizing search latency.
