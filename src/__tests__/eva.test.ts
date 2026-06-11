import { Eva } from '../eva';
import { describe, beforeEach, it, expect } from 'bun:test';
import { EvaNotFoundError } from '../errors';

const BASE = 'http://localhost';

function req(path: string, init?: RequestInit): Request {
  return new Request(`${BASE}${path}`, init);
}

const makeHandler = () => () => new Response('ok');

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
      expect(res.headers.get('Allow')).toBe('GET');
      expect(res.headers.get('Content-Type')).toBe('text/plain');
    });

    it('answers HEAD with the GET headers and an empty body', async () => {
      app.get('/', makeHandler());

      const res = await app.handle(req('/', { method: 'HEAD' }));

      expect(res.status).toBe(200);
      expect(await res.text()).toBe('');
      // HEAD copies the GET response headers (RFC 9110). Note: Bun does not
      // reflect the implicit Content-Type of `new Response('ok')` in
      // response.headers, so nothing is copied here — hence null.
      expect(res.headers.get('Content-Type')).toBe(null);
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
    it('captures the path consumed by the wildcard in ctx.params', async () => {
      app.get('/users/*', (ctx) => ctx.toJson(ctx.params));

      const res = await app.handle(req('/users/a/b/c'));

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ '*': 'a/b/c' });
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

    // TODO(design): accept a single middleware or varargs via spread instead
    // of forcing an array — revisit together with the phase 3 route API cleanup
    it('runs route middlewares after global middlewares', async () => {
      const order: string[] = [];
      app.use(async (_ctx, next) => {
        order.push('global');
        await next();
      });
      app.get(
        '/',
        [
          async (_ctx, next) => {
            order.push('route');
            await next();
          },
        ],
        () => {
          order.push('handler');
          return new Response('ok');
        },
      );

      await app.handle(req('/'));

      expect(order).toEqual(['global', 'route', 'handler']);
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
  });
});
