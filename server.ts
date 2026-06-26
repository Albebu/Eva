/**
 * Eva showcase — one example of every feature.
 * Run with `bun run dev` and try it with the Postman collection (eva.postman_collection.json).
 */

import { Eva } from './src/eva';
import { cors } from './src/cors';
import {
  EvaBadRequestError,
  EvaNotFoundError,
  EvaUnauthorizedError,
} from './src/errors';
import type { EvaMiddleware } from './src/types';
import { serveStatic } from './src/static';
import { bodyLimit } from './src/body-limit';

const app = new Eva();

// | Global middleware — runs on every request, in registration order |
// Each middleware receives (ctx, next) and must `await next()` to continue.

app.use(async (ctx, next) => {
  const start = performance.now();
  await next();
  const ms = (performance.now() - start).toFixed(1);
  console.log(`${ctx.req.method} ${ctx.path} (${ms}ms)`);
});

// | CORS — built-in middleware. Exact-match origins (string, array or '*') |

app.use(cors({ origin: '*' }));
app.use(async (ctx, next) => {
  console.log('Request: ', ctx.path);

  await next();
});

// | Error boundary — handles anything that is NOT an EvaError |
// EvaError subclasses skip this: they map to their own status automatically.

app.onError((error, _ctx) => {
  console.error('Unexpected error:', error);
  return new Response(JSON.stringify({ error: 'Something went wrong' }), {
    status: 500,
    headers: { 'Content-Type': 'application/json' },
  });
});

// | Static route + JSON response |

app.get('/', serveStatic('public/'));

// | Text response + custom header |

app.get('/health', (ctx) => {
  ctx.setHeader('X-Eva-Version', '0.1');
  return ctx.toText('ok');
});

// | Route params (:id) — percent-decoded automatically |

app.get('/echo/:id', (ctx) => {
  return ctx.toJson({ id: ctx.params.id });
});

// | Query string — available in ctx.query (always strings) |

app.get('/search', (ctx) => {
  return ctx.toJson({ query: ctx.query });
});

// | Wildcard — consumes the rest of the path into params['*'] |

app.get('/wildcard/*', (ctx) => {
  return ctx.toJson({ file: ctx.params['*'] });
});

// | JSON body — await ctx.json() (cached: safe to call twice) |

app.post('/items', async (ctx) => {
  const body = await ctx.json();
  return ctx.toJson({ created: body }, { status: 201 });
});

// | Cookies — read incoming with getCookies(), set with setCookie() |

app.get('/cookies', (ctx) => {
  ctx.setCookie({
    name: 'session',
    value: 'abc123',
    options: { path: '/', httpOnly: true, secure: true },
  });
  return ctx.toJson({ received: ctx.getCookies() });
});

// | Throwing errors — EvaError subclasses become HTTP responses |

app.get('/users/:id', (ctx) => {
  if (ctx.params.id === '999') {
    throw new EvaNotFoundError(`User ${ctx.params.id} does not exist`);
  }
  return ctx.toJson({ id: ctx.params.id, name: 'user' });
});

app.get('/boom', () => {
  throw new Error('unexpected failure');
});

// | Route-level middleware — array between the path and the handler |

const requireAuth: EvaMiddleware = async (ctx, next) => {
  if (ctx.getHeader('Authorization') !== 'secret') {
    throw new EvaUnauthorizedError();
  }
  await next();
};

app.get('/admin', [requireAuth], (ctx) => {
  return ctx.toText('welcome, admin');
});

// | Redirect |

app.get('/old-path', (ctx) => {
  return ctx.redirect('/', 301);
});

// | Route builder — group several methods on one path |

app
  .route('/tasks')
  .get((ctx) => ctx.toJson({ tasks: [] }))
  .post([bodyLimit(100 * 1024)], async (ctx) => {
    const items = await ctx.json();
    if (!Array.isArray(items) || items.length > 5) {
      throw new EvaBadRequestError('"items" must be an array of at most 5');
    }
    return ctx.toJson({ created: items }, { status: 201 });
  });

// | Composition — mount a child instance under a prefix |
// Known limitation: route-level middlewares are not copied yet (see roadmap).

const products = new Eva();

products.get('/products', (ctx) => {
  return ctx.toJson({ data: ['widget', 'gadget'] });
});

products.get('/products/:id', (ctx) => {
  return ctx.toJson({ data: { id: ctx.params.id } });
});

products.toParent(app, '/api/v1');

// | Also built in, with no code needed: |
//   HEAD -> any GET route answers HEAD with empty body
//   405  -> wrong method on a known path, with Allow header
//   404  -> unknown paths

// | Start — serve() returns the Bun server (port, stop(), ...) |

app.serve(9999, () => {
  console.log(`Eva listening on http://localhost:${9999}`);
});
