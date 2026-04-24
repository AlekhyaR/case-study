# Refactoring Changelog

Documents every change made to the original codebase, what was wrong, and why it was fixed.

---

## 1. Modularisation — everything in one file

**Original:** All route handlers, database logic, caching, and utilities lived in a single `index.js` (600+ lines).

**Fixed:** Split into focused modules:

```
src/
├── config/       database.js, environment.js
├── middleware/   auth.js, requestLogger.js
├── routes/       auth.js, template.js, categories.js, health.js
├── services/     templateService.js, categoryService.js, cacheService.js
├── utils/        database.js, error.js, jwt.js, logger.js
└── validation/   schemas.js, validate.js
```

---

## 2. SQL injection

**Original:** `/delete-template` interpolated `req.query.id` directly into the query string.

**Fixed:** All queries use parameterised placeholders (`$1`, `$2`, …) via the `pg` library throughout `templateService.js` and `categoryService.js`.

---

## 3. Single database connection → connection pool

**Original:** A single `pg.Client` was used, causing queuing under concurrent load and no reconnect behaviour.

**Fixed:** Replaced with `pg.Pool` (max 20 connections, 5 s connection timeout, 30 s idle timeout) in `src/config/database.js`.

---

## 4. N+1 query problem

**Original:** After fetching all templates, the code looped and issued a separate `SELECT` for each template's categories — 100 templates meant 101 queries.

**Fixed:** A single `LEFT JOIN` with `json_agg()` retrieves templates and their categories in one query. `COUNT(*) OVER()` adds the pagination total in the same pass. Defined as `TEMPLATE_QUERY` constant in `templateService.js` to avoid duplication.

---

## 5. No input validation

**Original:** Request bodies and query params were used directly with no type checking, allowing malformed data to reach the database.

**Fixed:** Zod schemas in `src/validation/schemas.js` define the expected shape of every request. `validateBody` and `validateQuery` middleware in `src/validation/validate.js` apply them before any handler runs. Invalid requests get a `400 VALIDATION_ERROR` response immediately.

Schemas defined:
- `LoginBodySchema`
- `CreateTemplateBodySchema`
- `UpdateTemplateBodySchema` (also enforces at least one updatable field)
- `CreateCategoryBodySchema`
- `IdQuerySchema`
- `PaginationSchema`
- `SearchQuerySchema`

---

## 6. Template ID type mismatch

**Original:** The database schema defines `id TEXT PRIMARY KEY` and seeds data with IDs like `tpl_001`, but route handlers called `parseInt(req.query.id, 10)` — making all seeded templates unreachable via the API.

**Fixed:** Validation schemas accept string IDs. `parseInt` removed from all route handlers.

---

## 7. GET used for a destructive operation

**Original:** `/delete-template` was registered on `app.get(...)`. GET requests must be safe and idempotent; using GET for deletion enables CSRF attacks and proxy/browser caching of the delete action.

**Fixed:** Changed to `router.delete(...)`.

---

## 8. Inconsistent HTTP response format

**Original:** Ten different response shapes across endpoints — some returned raw arrays, others wrapped objects, error responses leaked stack traces and internal pg error details.

**Fixed:** All responses follow a single structure:

```json
{ "ok": true,  "data": ..., "timestamp": "..." }
{ "ok": false, "error": "...", "type": "...", "timestamp": "..." }
```

Error messages are sanitised in `src/utils/error.js` — internal details are logged server-side only; clients receive a generic message and an `errorId` for support tracing.

---

## 9. No cache invalidation / broken cache

**Original:** The cache used a TTL flag but never stored the data inside the cache service — `isCacheValid()` always returned `false` because the service's `cache.templates` was never written. Separately, mutations (create/update/delete) never cleared the cache.

**Fixed:**
- `cacheService.js` now owns the data via `setCache(data)` / `getCache()`.
- All mutation endpoints call `invalidateCache()`.
- 5-minute TTL auto-expires stale data.
- Cache is only used for the default page (page 1, limit 50); paginated requests bypass it.

---

## 10. Missing pagination

**Original:** `/get-templates` and `/search-templates` returned every row in the table, which would crash or time out on large datasets.

**Fixed:** Both endpoints accept `?page=` and `?limit=` query params (default 50, max 100). `COUNT(*) OVER()` returns the total count in the same query. Responses include a `pagination` object:

```json
{ "page": 1, "limit": 50, "total": 243, "totalPages": 5 }
```

---

## 11. No authentication

**Original:** All endpoints were publicly accessible.

**Fixed:** JWT-based authentication added. `POST /auth/login` returns a signed token (24 h expiry). All endpoints except `/health` and `/auth/login` require `Authorization: Bearer <token>`.

**Known limitation:** The login endpoint accepts any username/password since there is no user store. In production this would need a `users` table with bcrypt-hashed passwords.

---

## 12. No graceful shutdown

**Original:** The process exited immediately on SIGTERM/SIGINT, potentially dropping in-flight requests and leaving database connections open.

**Fixed:** `gracefulShutdown()` in `src/config/database.js` closes the HTTP server, waits for in-flight requests to finish, then closes the connection pool. Registered for both `SIGTERM` and `SIGINT` in `src/index.js`. Forces exit after 10 s if shutdown stalls.

---

## 13. No request logging

**Original:** No visibility into which endpoints were hit, by whom, or how long they took.

**Fixed:** `requestLoggerMiddleware` wraps `res.end` to log method, path, status code, authenticated user, duration, and IP for every request.

---

## 14. Error information disclosure

**Original:** Raw pg errors (stack traces, SQL query text, internal column names) were forwarded directly to API responses.

**Fixed:** `classifyDatabaseError` maps pg error codes to HTTP status codes. `sanitizeErrorMessage` returns a generic human-readable message. The full error is logged server-side with a unique `errorId` that is returned to the client for support tracing.

---

## 15. update-template silent no-op

**Original:** If no updatable fields were provided, the SQL builder produced `UPDATE templates SET updated_at = now() WHERE id = $1` — returned `rowCount: 1` as if something changed.

**Fixed:** `UpdateTemplateBodySchema` rejects requests with no updatable fields (Zod `.refine()`). The service also short-circuits with `{ rowCount: 0 }` as a defence-in-depth guard.

---

## 16. requestCount never incremented

**Original:** The `/stats` endpoint declared `let requestCount = 0` but no code ever incremented it — always returned `0`.

**Fixed:** A counting middleware added in `src/index.js` increments `requestCount` on every incoming request.

---

## 17. Retry logic for transient database errors

**Original:** Any database error immediately failed the request with no retry.

**Fixed:** `queryWithRetry` in `src/utils/database.js` retries up to 3 times with exponential backoff (100 ms, 200 ms, 400 ms) for transient errors (connection refused, timeout). Non-transient errors (constraint violations, permission errors) are not retried.

---

## 18. API documentation

Added an OpenAPI 3.0 spec in `src/docs/swagger.js`, served as interactive Swagger UI at `GET /api-docs`.

---

## 19. Tests

Added Jest test suite (`npm test`) covering:

| File | What is tested |
|---|---|
| `tests/cacheService.test.js` | TTL expiry, get/set/invalidate |
| `tests/error.test.js` | DB error classification, message sanitisation |
| `tests/jwt.test.js` | Token generation and verification edge cases |
| `tests/auth.middleware.test.js` | Missing/invalid/valid token handling |
| `tests/schemas.test.js` | All Zod schemas — valid inputs, defaults, rejection cases |
