# Architecture & Setup Guide

## Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL running locally (or Docker)

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment
Copy `.env.example` to `.env` and fill in your values:
```bash
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASS=postgres
DB_NAME=appostrophe
JWT_SECRET=change-this-in-production
NODE_ENV=development
PORT=5003
```

### 3. Set up the database
```bash
# Create the database (first time only)
psql -U postgres -c "CREATE DATABASE appostrophe;"

# Run migrations + seed data
psql -U postgres -d appostrophe -f db/init/001_init.sql
```

Or with Docker:
```bash
npm run db:up   # starts postgres on port 6543 via docker-compose
```

### 4. Start the server
```bash
npm run start-case-study   # development
npm start                  # production
```

### 5. Verify
```bash
curl http://localhost:5003/health
# { "ok": true, "data": { "status": "healthy", "database": { "connected": true } } }
```

### 6. Run tests
```bash
npm test
```

### 7. API documentation (interactive)
Open `http://localhost:5003/api-docs` in a browser.

---

## High-Level Architecture

```
HTTP Request
     │
     ▼
┌─────────────────────────────────────────────────────┐
│                   src/index.js                      │
│  Express app bootstrap, middleware wiring, startup  │
└───────────────────────┬─────────────────────────────┘
                        │
          ┌─────────────▼──────────────┐
          │       Middleware stack      │
          │  express.json()            │
          │  requestLoggerMiddleware   │
          │  swagger-ui (/api-docs)    │
          │  requestCount counter      │
          └─────────────┬──────────────┘
                        │
          ┌─────────────▼──────────────┐
          │          Routes            │
          │  /auth     → auth.js       │
          │  /health   → health.js     │
          │  /stats    → inline        │
          │  /get-*    → template.js   │
          │  /create-* → template.js   │
          │  /update-* → template.js   │
          │  /delete-* → template.js   │
          │  /search-* → template.js   │
          │  /get-template-categories  │
          │  /create-template-category │
          └─────────────┬──────────────┘
                        │
     ┌──────────────────▼─────────────────────┐
     │         Per-request middleware          │
     │  authenticateToken  (JWT check)         │
     │  validateBody / validateQuery  (Zod)    │
     └──────────────────┬─────────────────────┘
                        │
     ┌──────────────────▼─────────────────────┐
     │              Services                   │
     │  templateService.js   (SQL queries)     │
     │  categoryService.js   (SQL queries)     │
     │  cacheService.js      (in-memory TTL)   │
     └──────────────────┬─────────────────────┘
                        │
     ┌──────────────────▼─────────────────────┐
     │           PostgreSQL (via pg.Pool)      │
     │  templates, categories,                 │
     │  template_categories                    │
     └─────────────────────────────────────────┘
```

---

## Module Map

```
src/
├── index.js                 App bootstrap, server startup
│
├── config/
│   ├── database.js          pg.Pool setup, testConnection(), gracefulShutdown()
│   └── environment.js       Validates required env vars on startup
│
├── middleware/
│   ├── auth.js              authenticateToken — verifies JWT Bearer token
│   └── requestLogger.js     Logs method, path, status, user, duration per request
│
├── routes/
│   ├── auth.js              POST /auth/login
│   ├── template.js          All /get-templates, /get-template, /create-template,
│   │                        /update-template, /delete-template, /search-templates
│   ├── categories.js        GET /get-template-categories, POST /create-template-category
│   └── health.js            GET /health
│
├── services/
│   ├── templateService.js   All template SQL (TEMPLATE_QUERY base, pagination,
│   │                        createTemplate, updateTemplate, deleteTemplate, search)
│   ├── categoryService.js   getAllCategories(), createCategory()
│   └── cacheService.js      In-memory cache with 5-minute TTL
│
├── validation/
│   ├── schemas.js           All Zod schemas:
│   │                          request  — LoginBodySchema, CreateTemplateBodySchema,
│   │                                     UpdateTemplateBodySchema, CreateCategoryBodySchema,
│   │                                     IdQuerySchema, PaginationSchema, SearchQuerySchema
│   │                          DB rows  — TemplateRowSchema, CategoryRowSchema, TemplateDTOSchema
│   │                          responses — SuccessResponseSchema, PaginatedResponseSchema,
│   │                                      ErrorResponseSchema
│   └── validate.js          validateBody(schema), validateQuery(schema) middleware factories
│
├── utils/
│   ├── database.js          queryWithRetry() — 3 attempts, exponential backoff
│   ├── error.js             classifyDatabaseError(), sanitizeErrorMessage(), handleError()
│   ├── jwt.js               generateToken(), verifyToken()
│   ├── logger.js            log(), logRequest(), logError() — level-filtered console output
│   └── response.js          success(data), paginated(data, pagination) — response builders
│
└── docs/
    └── swagger.js           OpenAPI 3.0 spec (served at /api-docs)
```

---

## Request Lifecycle — Walkthrough

Using `GET /get-templates?page=2&limit=20` as an example:

```
1. express.json()
   Parses JSON body (no body here, but middleware always runs).

2. requestLoggerMiddleware
   Records start time, wraps res.end() to log after response is sent.

3. requestCount++
   Increments the in-memory request counter.

4. router.get('/get-templates', ...)
   Express matches the route.

5. authenticateToken
   Reads Authorization header → extracts Bearer token → calls verifyToken().
   ✗ No token or invalid → 401 UNAUTHORIZED, request stops here.
   ✓ Valid → decodes payload into req.user, calls next().

6. validateQuery(PaginationSchema)
   Runs Zod safeParse on req.query = { page: "2", limit: "20" }.
   Coerces strings to numbers → { page: 2, limit: 20 }.
   ✗ Bad input (e.g. page=abc) → 400 VALIDATION_ERROR, stops here.
   ✓ Valid → replaces req.query with parsed data, calls next().

7. Route handler
   a. useCache = (page === 1 && limit === 50)  →  false, cache skipped.
   b. templateService.getAllTemplates(20, 20)
      Runs:
        SELECT t.*, json_agg(c.slug) FILTER (...) as categories,
               COUNT(*) OVER() as total_count
        FROM templates t
        LEFT JOIN template_categories tc ON t.id = tc.template_id
        LEFT JOIN categories c ON c.id = tc.category_id
        GROUP BY t.id, ...
        ORDER BY t.order_index ASC
        LIMIT 20 OFFSET 20
      queryWithRetry wraps this — retries up to 3× on transient errors.
   c. total extracted from result.rows[0].total_count (window function).
   d. Each row passed through TemplateRowSchema.parse() inside mapTemplate().
      Validates shape, strips total_count, normalises categories null→[].
   e. res.json(paginated(data, { page:2, limit:20, total:43, totalPages:3 }))

8. requestLoggerMiddleware (res.end hook fires)
   Logs: GET /get-templates 200 alice 34ms
```

---

## Authentication Flow

```
Client                         Server
  │                               │
  │  POST /auth/login             │
  │  { username, password }       │
  │──────────────────────────────►│
  │                               │  validateBody(LoginBodySchema)
  │                               │  generateToken({ username, iat })
  │  { ok:true, data:{ token } }  │
  │◄──────────────────────────────│
  │                               │
  │  GET /get-templates           │
  │  Authorization: Bearer <tok>  │
  │──────────────────────────────►│
  │                               │  authenticateToken → verifyToken()
  │                               │  sets req.user = { username, ... }
  │  { ok:true, data:[...] }      │
  │◄──────────────────────────────│
```

Tokens are signed with `JWT_SECRET`, expire after 24 hours.

> Known limitation: the login endpoint accepts any username/password — there is
> no user store. In production this requires a `users` table and bcrypt.

---

## Caching Strategy

Only `GET /get-templates` at the default page (page=1, limit=50) is cached.

```
Request arrives
      │
      ▼
isCacheValid()?  ──yes──►  return cached { data, pagination }
      │
      no
      │
      ▼
Query DB (getAllTemplates)
      │
      ▼
setCache({ data, total })   ← stores for 5 minutes
      │
      ▼
Return response

On any mutation (create / update / delete template or category):
  invalidateCache()  ←  next read hits the DB and refreshes
```

---

## Database Schema

```
templates
  id          TEXT PRIMARY KEY      (e.g. "tpl_001")
  title       TEXT NOT NULL
  source      JSONB NOT NULL        (arbitrary canvas/layer config)
  order_index INTEGER DEFAULT 0
  created_at  TIMESTAMPTZ DEFAULT now()
  updated_at  TIMESTAMPTZ DEFAULT now()

categories
  id   SERIAL PRIMARY KEY
  slug TEXT UNIQUE NOT NULL         (e.g. "instagram", "minimal")

template_categories              (many-to-many join)
  template_id  TEXT → templates(id)   ON DELETE CASCADE
  category_id  INT  → categories(id)  ON DELETE CASCADE
```

All template reads use a single `LEFT JOIN` with `json_agg()` to fetch
categories in the same query — no N+1 queries.

---

## Error Handling

Every database error is processed through `src/utils/error.js`:

| pg error code | HTTP status | type       |
|---------------|-------------|------------|
| ECONNREFUSED  | 503         | CONNECTION |
| timeout       | 504         | TIMEOUT    |
| 42501         | 403         | PERMISSION |
| 42P01         | 400         | NOT_FOUND  |
| 23505         | 409         | CONFLICT   |
| anything else | 500         | UNKNOWN    |

The raw error is logged server-side with a unique `errorId`. The client only
receives a generic message and the `errorId` for support tracing.

---

## Environment Variables

| Variable    | Required | Description                          |
|-------------|----------|--------------------------------------|
| DB_HOST     | yes      | PostgreSQL host                      |
| DB_PORT     | yes      | PostgreSQL port (5432 for local)     |
| DB_USER     | yes      | Database user                        |
| DB_PASS     | yes      | Database password                    |
| DB_NAME     | yes      | Database name                        |
| JWT_SECRET  | yes      | Secret for signing JWT tokens        |
| NODE_ENV    | yes      | `development` or `production`        |
| PORT        | no       | HTTP port (default: 5003)            |
| LOG_LEVEL   | no       | ERROR / WARN / INFO / DEBUG (default: INFO) |

The server validates all required variables at startup and exits immediately
if any are missing (`src/config/environment.js`).
