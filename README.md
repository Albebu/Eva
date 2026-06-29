# Eva HTTP Framework

![Bun](https://img.shields.io/badge/Bun-1.3+-yellow)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)
![Dependencies](https://img.shields.io/badge/dependencies-0-red)
![License](https://img.shields.io/badge/license-MIT-green)

A lightweight, fast HTTP framework for Bun, built from scratch with TypeScript.

Inspired by Elysia, Hono, and Express — but designed to understand how frameworks actually work under the hood.

No external dependencies. Pure Bun APIs.

## Quick Start

```typescript
import { Eva } from './src/eva';
import { cors } from './src/cors';

const eva = new Eva();

// Middleware
eva.use(async (ctx, next) => {
  console.log(`${ctx.req.method} ${ctx.req.url}`);
  await next();
});

// CORS
eva.use(cors({ origin: '*' }));

// Routes
eva.get('/', () => {
  return new Response('Hello from Eva!');
});

eva.get('/api/users/:id', (ctx) => {
  return ctx.toJson({ id: ctx.params.id, name: 'Alex' });
});

eva.post('/api/users', async (ctx) => {
  const body = await ctx.json();
  return ctx.toJson({ created: true, data: body }, { status: 201 });
});

// Listen
eva.serve();
```

## Features

- **Trie routing** — efficient route matching with param extraction
- **Middleware** — global and route-level
- **Built-in CORS** — configurable cross-origin support
- **Error handling** — custom error hierarchy
- **HEAD method** — automatic HEAD route generation
- **405 Method Not Allowed** — proper response for unsupported methods
- **No external dependencies** — pure Bun, pure learning

## API Reference

### Eva

```typescript
const eva = new Eva();

eva.get(route, handler); // GET
eva.post(route, handler); // POST
eva.put(route, handler); // PUT
eva.patch(route, handler); // PATCH
eva.delete(route, handler); // DELETE
eva.options(route, handler); // OPTIONS
// HEAD is derived automatically from each GET route — no eva.head()

eva.use(middleware); // global middleware
eva.serve(port, callback); // start server
```

### Context

```typescript
// request
ctx.json<B>(); // parse JSON body (cached)
ctx.text(); // raw body text (cached)
ctx.form<B>(); // parse form body (cached)
ctx.params; // route parameters
ctx.query; // parsed query string
ctx.getHeader(name); // get request header
ctx.getCookies(); // parsed request cookies
ctx.req; // original Request

// response
ctx.toJson(data, options); // JSON response
ctx.toText(data, options); // text response
ctx.redirect(url, status); // redirect response
ctx.setHeader(name, value); // set response header
ctx.setCookie({ name, value, options }); // set response cookie
```

### Middleware

```typescript
type EvaMiddleware = (
  ctx: EvaContext,
  next: () => Promise<void>,
) => Promise<void>;
```

## Architecture

```
Request
  ↓
Middleware Chain (global)
  ↓
Route Matching (Trie)
  ↓
Route Middleware (per-route)
  ↓
Handler
  ↓
Response
```

## Testing

```bash
bun test            # run the suite
bun test --watch    # re-run on change
bun test --coverage # coverage report
```

Tests live next to the code as `*.test.ts` and use `bun:test` (Jest-compatible API, zero config).

## Roadmap

The order matters: phase 0 makes the framework testable, phase 1 locks current behavior in tests and fixes known bugs against those tests, and only then do new features land — always test-first.

### Phase 0 — Testability foundation

- [x] Extract the `fetch` closure in `Eva.serve()` into a public `handle(req: Request): Promise<Response>` method, so the whole framework can be tested with `app.handle(new Request(...))` without binding a port (this is how Hono's `app.fetch` and Elysia's `app.handle` work)
- [x] Make `serve()` use `handle()` internally and return the `Bun.serve` server instance instead of `void` (needed to call `server.stop()` in e2e tests)
- [x] Set up the first `*.test.ts` file and a `bun test` script in `package.json`

### Phase 1 — Lock behavior + fix known bugs (test-first: write the failing test, then fix)

- [x] Characterization tests for what already works: static routes, `:params`, query parsing, 404, 405 + `Allow` header, automatic HEAD, middleware order (global → route → handler)
- [x] **Design fix**: allow middleware to short-circuit with a response (`EvaMiddleware` returning `Response | void`, or a response builder on the context). Today a middleware that doesn't call `next()` leaves `response` as `undefined` and `serve()` does `return response!` — the CORS preflight path hits exactly this
- [x] **Bug**: invalid JSON body → `JSON.parse` in `src/context.ts` throws an unhandled `SyntaxError` and the client gets a 500. Expected: 400 Bad Request
- [x] **Bug**: CORS origin check in `src/cors.ts` uses `.includes()`, which is substring matching when `origin` is a string — `"https://example.com".includes("https://example.co")` is `true`, so a malicious origin passes. Handle the string case and the array case explicitly
- [x] **Bug**: CORS preflight (OPTIONS) is only short-circuited in the `"*"` branch; specific-origin preflights fall through. Decide the preflight behavior once and test it for both branches
- [x] **Bug**: `toParent()` copies handlers but drops route-level middlewares (`addRoute` is called without `node.middlewares`)
- [x] **Bug**: registering `/users/:id` and then `/users/:userId/posts` silently reuses the first param name (`router.ts` keeps the existing `node.param`). Throw on conflicting param names at registration time
- [x] Guard the `return response!` path: if a handler/middleware chain produces no response, return a deliberate 500 (or throw a descriptive error), never `undefined`

### Phase 2 — Router robustness (edge cases)

- [x] Trailing slash policy: STRICT (Fastify/Hono-style) — `/users/` and `/users` are different routes; params never capture empty segments. Documented in Router's JSDoc and pinned by tests
- [x] Empty segments (`//users`), URL-encoded params (`/users/a%20b` should decode to `a b`)
- [x] Static-over-param priority: `/users/me` must win over `/users/:id`, including backtracking when a static prefix dead-ends
- [x] Wildcard routes (`/static/*`)
- [ ] Route-level middleware scope: today middleware registered on `/users` also runs for `/users/:id` because `match()` collects middlewares from intermediate nodes — decide if that's a feature (Express-style mounting) or a bug, then test the decision
- [ ] Include OPTIONS/HEAD in the 405 `Allow` calculation

### Phase 3 — Missing core features

- [ ] Content-type-aware body parsing: `application/x-www-form-urlencoded` and `multipart/form-data`, plus a body size limit
- [ ] Cookies: parse on request, set on response (needed for any real auth)
- [ ] Full CORS options: `allowedHeaders`, `credentials`, `maxAge`, `exposeHeaders`, per-config methods
- [ ] Consolidate the route API: `get/post/...` overloads vs `route().getWith()` builder — one obvious way to do it

### Phase 4 — DX and advanced TypeScript (the differentiators)

- [ ] Infer param types from the path string with template literal types: `eva.get("/users/:id/posts/:postId", ...)` should type `ctx.params` as `{ id: string; postId: string }` without manual generics (this is the Hono/Elysia trick)
- [ ] Schema validation hook for body/query/params (bring-your-own validator, e.g. Standard Schema)
- [ ] Resolve the `toParent()` API doubt: switch to Express-style composition `parent.mount(prefix, child)` (see the comment in `src/eva.ts`)

### Phase 5 — Ship it

- [ ] GitHub Actions: `bun test` + typecheck on every push
- [ ] Honest benchmarks vs Hono, Elysia and Express (and explain the results, especially the losses)
- [ ] Dogfood: build and deploy one small real API with Eva
- [ ] Publish to npm

## License

MIT
