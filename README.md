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
import { Eva } from "./src/eva";
import { cors } from "./src/cors";

const eva = new Eva();

// Middleware
eva.use(async (ctx, next) => {
  console.log(`${ctx.req.method} ${ctx.req.url}`);
  await next();
});

// CORS
eva.use(cors({ origin: "*" }));

// Routes
eva.get("/", () => {
  return new Response("Hello from Eva!");
});

eva.get("/api/users/:id", (ctx) => {
  return ctx.json({ id: ctx.params.id, name: "Alex" });
});

eva.post("/api/users", async (ctx) => {
  const body = await ctx.req.json();
  return ctx.json({ created: true, data: body }, { status: 201 });
});

// Listen
eva.serve()
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
const eva = new Eva()

eva.get(route, handler)     // GET
eva.post(route, handler)    // POST
eva.put(route, handler)     // PUT
eva.patch(route, handler)   // PATCH
eva.delete(route, handler)  // DELETE
eva.options(route, handler) // OPTIONS
eva.head(route, handler)    // HEAD

eva.use(middleware)          // global middleware
eva.listen(port, callback)   // start server
```

### Context

```typescript
ctx.json(data, options)     // JSON response
ctx.text(text, options)      // text response
ctx.getHeader(name)          // get request header
ctx.setHeader(name, value)   // set response header
ctx.params                   // route parameters
ctx.req                       // original Request
```

### Middleware

```typescript
type EvaMiddleware = (
  ctx: EvaContext,
  next: () => Promise<void>
) => Promise<void>
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

## License

MIT