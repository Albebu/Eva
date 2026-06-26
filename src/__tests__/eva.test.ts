import { Eva } from '../eva';
import { describe, beforeEach, it, expect, test, mock } from 'bun:test';
import { EvaNotFoundError } from '../errors';
import { EvaContext } from '../eva-context';

const BASE = 'http://localhost';

function req(path: string, init?: RequestInit): Request {
  return new Request(`${BASE}${path}`, init);
}

const makeHandler = (method?: string) => (ctx: EvaContext) =>
  ctx.toText(method ?? 'ok');

describe('Eva.handle', () => {
  let app: Eva;

  beforeEach(() => {
    app = new Eva();
  });

  describe('routing', () => {
    it('returns the handler response when the route is found', async () => {
      app.get('/', makeHandler());

      const res = await app.handle(req('/'));

      expect(res.status).toBe(200);
      expect(await res.text()).toBe('ok');
    });

    it('returns 404 when the route is not found', async () => {
      const res = await app.handle(req('/not-found'));

      expect(res.status).toBe(404);
      expect(await res.text()).toBe('Not Found 404');
    });

    it('returns 405 with the Allow header when the method is not allowed', async () => {
      app.get('/', makeHandler());

      const res = await app.handle(req('/', { method: 'POST' }));

      expect(res.status).toBe(405);
      expect(await res.text()).toContain('Not Allowed');
      expect(res.headers.get('Allow')).toBe('GET, HEAD');
      expect(res.headers.get('Content-Type')).toBe('text/plain');
    });

    it('includes OPTIONS and derived HEAD in the 405 Allow header', async () => {
      app.get('/', makeHandler());
      app.options('/', makeHandler());

      const res = await app.handle(req('/', { method: 'POST' }));

      expect(res.status).toBe(405);
      const allow = res.headers.get('Allow')!.split(', ');
      expect(allow).toContain('GET');
      expect(allow).toContain('OPTIONS');
      expect(allow).toContain('HEAD'); // never registered, derived from GET
    });

    it('answers HEAD with the GET headers and an empty body', async () => {
      app.get('/', makeHandler());

      const res = await app.handle(req('/', { method: 'HEAD' }));

      expect(res.status).toBe(200);
      expect(await res.text()).toBe('');
      // HEAD copies the GET response headers (RFC 9110) — including the
      // explicit Content-Type that toText() sets.
      expect(res.headers.get('Content-Type')).toBe('text/plain');
    });

    it('parses the query string into ctx.query', async () => {
      app.get('/', (ctx) => ctx.toJson(ctx.query));

      const res = await app.handle(req('/?name=John&age=30'));

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ name: 'John', age: '30' });
    });

    it('percent-decodes route params before reaching the handler', async () => {
      app.get('/users/:id', (ctx) => ctx.toJson(ctx.params));

      const res = await app.handle(req('/users/a%20b'));

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ id: 'a b' });
    });

    it('returns 400 when a route param has malformed percent-encoding', async () => {
      app.get('/users/:id', (ctx) => ctx.toJson(ctx.params));

      const res = await app.handle(req('/users/%zz'));

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: 'Malformed URL encoding' });
    });

    it('omits absent optional params after the full pipeline', async () => {
      app.get('/posts/:year/:month?', (ctx) => ctx.toJson(ctx.params));

      const res = await app.handle(req('/posts/2026'));

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ year: '2026' });
    });
    it('captures the path consumed by the wildcard in ctx.params', async () => {
      app.get('/users/*', (ctx) => ctx.toJson(ctx.params));

      const res = await app.handle(req('/users/a/b/c'));

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ '*': 'a/b/c' });
    });
    it('chains every method on one path through the route builder', async () => {
      app
        .route('/users')
        .get(makeHandler('GET'))
        .post(makeHandler('POST'))
        .put(makeHandler('PUT'))
        .patch(makeHandler('PATCH'))
        .delete(makeHandler('DELETE'))
        .options(makeHandler('OPTIONS'));

      // Local list on purpose: depending on the framework's `methods`
      // constant would break this test if its order or content changed,
      // without the builder being broken at all.
      const verbs = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'];

      for (const method of verbs) {
        const res = await app.handle(req('/users', { method }));

        expect(res.status).toBe(200);
        expect(await res.text()).toBe(method);
      }
    });

    it('accepts optional middlewares before the handler in the builder verbs', async () => {
      const order: string[] = [];
      app.route('/guarded').get(
        async (_ctx, next) => {
          order.push('middleware');
          await next();
        },
        (ctx) => {
          order.push('handler');
          return ctx.toText('ok');
        },
      );

      const res = await app.handle(req('/guarded'));

      expect(res.status).toBe(200);
      expect(await res.text()).toBe('ok');
      expect(order).toEqual(['middleware', 'handler']);
    });
  });

  describe('middleware', () => {
    it('runs global middlewares in registration order, before the handler', async () => {
      const order: number[] = [];
      for (let i = 1; i < 6; i++) {
        app.use(async (_ctx, next) => {
          order.push(i);
          await next();
        });
      }
      app.get('/', () => {
        order.push(6);
        return new Response('ok');
      });

      await app.handle(req('/'));

      expect(order).toEqual([1, 2, 3, 4, 5, 6]);
    });

    it('runs route middlewares after global middlewares', async () => {
      const order: string[] = [];
      app.use(async (_ctx, next) => {
        order.push('global');
        await next();
      });
      app.get(
        '/',
        async (_ctx, next) => {
          order.push('route');
          await next();
        },
        () => {
          order.push('handler');
          return new Response('ok');
        },
      );

      await app.handle(req('/'));

      expect(order).toEqual(['global', 'route', 'handler']);
    });

    it('accepts several route middlewares via spread, in order, handler last', async () => {
      const order: string[] = [];
      const mw =
        (tag: string) =>
        async (_ctx: EvaContext, next: () => Promise<void>) => {
          order.push(tag);
          await next();
        };
      app.get('/', mw('a'), mw('b'), mw('c'), () => {
        order.push('handler');
        return new Response('ok');
      });

      await app.handle(req('/'));

      expect(order).toEqual(['a', 'b', 'c', 'handler']);
    });

    it('runs global middlewares before routing, even when no route matches', async () => {
      const order: string[] = [];
      app.use(async (_ctx, next) => {
        order.push('middleware');
        await next();
      });

      const res = await app.handle(req('/nope'));

      expect(res.status).toBe(404);
      expect(order).toEqual(['middleware']);
    });

    it('short-circuits with the middleware response without running the handler', async () => {
      const order: string[] = [];
      app.use(async () => {
        order.push('middleware');
        return new Response('middleware response');
      });
      app.get('/', () => {
        order.push('handler');
        return new Response('handler response');
      });

      const res = await app.handle(req('/'));

      expect(res.status).toBe(200);
      expect(await res.text()).toBe('middleware response');
      // the whole point of the short-circuit: nothing after the middleware ran
      expect(order).toEqual(['middleware']);
    });

    it('overrides the handler response when a middleware returns one after next()', async () => {
      const handler = mock((ctx: EvaContext) => ctx.toText('handler response'));
      app.use(async (_ctx, next) => {
        await next();
        return new Response('middleware response');
      });
      app.get('/', handler);

      const res = await app.handle(req('/'));

      // the outermost response wins, but the chain did run
      expect(await res.text()).toBe('middleware response');
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe('HTTP verbs', () => {
    test.each([
      ['PUT', () => app.put('/resource', (ctx) => ctx.toText('PUT'))],
      ['PATCH', () => app.patch('/resource', (ctx) => ctx.toText('PATCH'))],
      ['DELETE', () => app.delete('/resource', (ctx) => ctx.toText('DELETE'))],
      [
        'OPTIONS',
        () => app.options('/resource', (ctx) => ctx.toText('OPTIONS')),
      ],
    ] as const)(
      '%s requests reach their handler',
      async (method: string, register: () => void) => {
        register();

        const res = await app.handle(req('/resource', { method }));

        expect(res.status).toBe(200);
        expect(await res.text()).toBe(method);
      },
    );

    it('accepts route middlewares on non-GET verbs', async () => {
      const order: string[] = [];
      app.delete(
        '/resource',
        async (_ctx, next) => {
          order.push('middleware');
          await next();
        },
        (ctx) => {
          order.push('handler');
          return ctx.toText('deleted');
        },
      );

      const res = await app.handle(req('/resource', { method: 'DELETE' }));

      expect(res.status).toBe(200);
      expect(order).toEqual(['middleware', 'handler']);
    });
  });

  describe('response helpers', () => {
    it('redirect() defaults to 301 with the Location header', async () => {
      app.get('/old', (ctx) => ctx.redirect('/new'));

      const res = await app.handle(req('/old'));

      expect(res.status).toBe(301);
      expect(res.headers.get('Location')).toBe('/new');
    });

    it('redirect() honors an explicit status code', async () => {
      app.get('/old', (ctx) => ctx.redirect('/new', 307));

      const res = await app.handle(req('/old'));

      expect(res.status).toBe(307);
      expect(res.headers.get('Location')).toBe('/new');
    });

    it('toText() responds with a text/plain Content-Type', async () => {
      app.get('/', (ctx) => ctx.toText('plain', { status: 418 }));

      const res = await app.handle(req('/'));

      expect(res.status).toBe(418);
      expect(res.headers.get('Content-Type')).toBe('text/plain');
      expect(await res.text()).toBe('plain');
    });

    it('headers set via setHeader() land on the final response', async () => {
      app.get('/', (ctx) => {
        ctx.setHeader('X-Custom', 'eva');
        return ctx.toJson({ ok: true });
      });

      const res = await app.handle(req('/'));

      expect(res.headers.get('X-Custom')).toBe('eva');
      expect(await res.json()).toEqual({ ok: true });
    });

    it('exposes request headers and path through the context', async () => {
      app.get('/inspect', (ctx) =>
        ctx.toJson({ header: ctx.getHeader('X-In'), path: ctx.path }),
      );

      const res = await app.handle(
        req('/inspect', { headers: { 'X-In': 'hello' } }),
      );

      expect(await res.json()).toEqual({ header: 'hello', path: '/inspect' });
    });
  });

  describe('body parsing', () => {
    it('exposes a valid JSON body through ctx.json()', async () => {
      app.post('/', async (ctx) => ctx.toJson(await ctx.json()));

      const res = await app.handle(
        req('/', {
          method: 'POST',
          body: JSON.stringify({ name: 'John', age: 30 }),
        }),
      );

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ name: 'John', age: 30 });
    });

    it('returns the cached body when ctx.json() is called twice', async () => {
      app.post('/', async (ctx) => {
        const first = await ctx.json();
        const second = await ctx.json();
        return ctx.toJson({ same: first === second, body: first });
      });

      const res = await app.handle(
        req('/', { method: 'POST', body: JSON.stringify({ a: 1 }) }),
      );

      expect(await res.json()).toEqual({ same: true, body: { a: 1 } });
    });

    it('exposes the raw body through ctx.text()', async () => {
      app.post('/raw', async (ctx) => ctx.toText(await ctx.text()));

      const res = await app.handle(
        req('/raw', { method: 'POST', body: 'plain text body' }),
      );

      expect(res.status).toBe(200);
      expect(await res.text()).toBe('plain text body');
    });

    it('returns a 400 HTTP code when json body malformed', async () => {
      app.post('/', async (ctx) => {
        await ctx.json();
        return ctx.toJson({ message: 'ok' });
      });

      const res = await app.handle(
        req('/', { method: 'POST', body: '{"name": "a"' }),
      );

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: 'Malformed JSON body' });
    });

    it('parses an urlencoded body into an object through ctx.form()', async () => {
      app.post('/', async (ctx) => ctx.toJson(await ctx.form()));

      const res = await app.handle(
        req('/', {
          method: 'POST',
          body: new URLSearchParams({ name: 'John', age: '30' }),
        }),
      );

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ name: 'John', age: '30' });
    });

    it('parses a multipart body into an object through ctx.form()', async () => {
      app.post('/', async (ctx) => ctx.toJson(await ctx.form()));

      const body = new FormData();
      body.append('name', 'John');
      body.append('age', '30');

      const res = await app.handle(req('/', { method: 'POST', body }));

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ name: 'John', age: '30' });
    });

    it('returns the cached body when ctx.form() is called twice', async () => {
      app.post('/', async (ctx) => {
        const first = await ctx.form();
        const second = await ctx.form();
        return ctx.toJson({ same: first === second, body: first });
      });

      const res = await app.handle(
        req('/', {
          method: 'POST',
          body: new URLSearchParams({ a: '1' }),
        }),
      );

      expect(await res.json()).toEqual({ same: true, body: { a: '1' } });
    });

    it('returns a 400 HTTP code when the form body is malformed', async () => {
      app.post('/', async (ctx) => {
        await ctx.form();
        return ctx.toJson({ message: 'ok' });
      });

      const res = await app.handle(
        req('/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{"name":"a"}',
        }),
      );

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: 'Malformed form data' });
    });
  });

  describe('error handling', () => {
    it('maps a thrown EvaError to its status code and a JSON error body', async () => {
      app.get('/', () => {
        throw new EvaNotFoundError('user does not exist');
      });

      const res = await app.handle(req('/'));

      expect(res.status).toBe(404);
      expect(res.headers.get('Content-Type')).toBe('application/json');
      expect(await res.json()).toEqual({ error: 'user does not exist' });
    });

    it('returns a generic 500 for unknown errors without leaking details', async () => {
      app.get('/', () => {
        throw new Error('secret internal detail');
      });

      const res = await app.handle(req('/'));

      expect(res.status).toBe(500);
      const body = await res.text();
      expect(body).toContain('Internal Server Error');
      expect(body).not.toContain('secret');
    });

    it('delegates unknown errors to a registered onError handler', async () => {
      app.onError(() => new Response('custom error page', { status: 503 }));
      app.get('/', () => {
        throw new Error('boom');
      });

      const res = await app.handle(req('/'));

      expect(res.status).toBe(503);
      expect(await res.text()).toBe('custom error page');
    });
  });

  describe('composition', () => {
    it('exposes child instance routes under the prefix after toParent()', async () => {
      const child = new Eva();
      child.get('/users/:id', (ctx) => ctx.toJson(ctx.params));
      child.toParent(app, '/api');

      const res = await app.handle(req('/api/users/7'));

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ id: '7' });
    });

    it('preserves route-level middlewares through toParent()', async () => {
      const order: string[] = [];
      const child = new Eva();
      child.get(
        '/users',
        async (_ctx, next) => {
          order.push('middleware');
          await next();
        },
        (ctx) => {
          order.push('handler');
          return ctx.toText('ok');
        },
      );
      child.toParent(app, '/api');

      const res = await app.handle(req('/api/users'));

      expect(res.status).toBe(200);
      expect(order).toEqual(['middleware', 'handler']);
    });

    it('preserves wildcard routes through toParent()', async () => {
      const child = new Eva();
      child.get('/static/*', (ctx) => ctx.toJson(ctx.params));
      child.toParent(app, '/assets');

      const res = await app.handle(req('/assets/static/css/main.css'));

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ '*': 'css/main.css' });
    });
  });
});
