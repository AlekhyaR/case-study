Issue 2:

data.id → id

Earlier in the handler we added:


var id = parseInt(data.id, 10);
data.id is the raw string from the request body (e.g. "5"). id is the parsed, validated integer (5). We pass id to the query so the DB receives the correct type — using data.id after that would bypass the parsing and send the raw string again.

data.order_index || 0 → data.order_index !== undefined ? Number(data.order_index) : 0

The old || 0 had a silent bug — it also replaced 0 with 0, which seems fine, but it would also replace any falsy value like false, "", or null with 0 instead of catching them as invalid.

More critically, || doesn't distinguish between "not provided" and "provided as 0". If someone intentionally sends order_index: 0, the old code still correctly stores 0, but for the wrong reason — it's relying on 0 || 0 = 0 being coincidentally right.

The new version is explicit:

If order_index was not sent at all → default to 0
If it was sent → convert it to a number with Number() so the DB gets an integer, not a string like "3"
======================
Issue 3: GET for mutations - Violates REST, enables CSRF attacks, cache poisoning

One line change — app.get → app.delete. Here's why each problem is fixed:

REST violation — GET must be safe and idempotent (no side effects). A DELETE operation clearly has a side effect, so it belongs on the DELETE HTTP method. Clients, proxies, and tools all rely on this contract.

CSRF — GET requests are triggered by anything that loads a URL: an <img> tag, a link, a browser prefetch. An attacker could embed <img src="http://localhost:5003/delete-template?id=5"> in a page and the victim's browser silently deletes the template on load. DELETE requests require an explicit fetch/XMLHttpRequest call with the correct method, which browsers block cross-origin by default.

Cache poisoning — Browsers, CDNs, and proxies cache GET responses. A cached "deleted" response could be replayed, or worse, a cached "not found" response could mask a real record. DELETE is never cached.

To call it now:


curl -X DELETE "http://localhost:5003/delete-template?id=5"
====================
Issue 4: Single database connection - Fails under load
Two changes:

Client → Pool: Pool maintains multiple connections internally (default: up to 10) and hands them out to concurrent requests, returning them when done. Client is a single persistent connection — if two requests arrive simultaneously, the second one queues behind the first.

Removed client.connect(): Pool manages its own connections lazily — it opens one when a query needs it and closes idle ones automatically. Calling .connect() on a pool is only needed when you want a dedicated connection (e.g. for transactions), which isn't the case here.

Everything else (client.query(...) calls across all routes) stays exactly the same — Pool exposes the same .query() API.
===============
Issue: 5 Broken response formats - 10 different error/success formats

All responses now follow two consistent shapes:

Errors (400/404/500):


{ "ok": false, "error": "message" }
Mutation successes (/create-*, /update-*, /delete-*):


{ "ok": true, ...data }
List/read endpoints (/get-templates, /get-template-categories, /search-templates) return raw arrays — that's standard REST and doesn't need a wrapper.

Two extra fixes included in the standardization:

Stack traces removed from all error responses — stack, detail, msg, code, where all leaked internal pg and Node internals to the client.
/get-template not-found now returns 404 instead of a 200 with { found: false } — a missing resource should be a 404, not a successful response.
=================

