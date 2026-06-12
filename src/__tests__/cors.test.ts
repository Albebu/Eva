import { Eva } from '../eva';
import { cors } from '../cors';
import { describe, beforeEach, it, expect } from 'bun:test';

const BASE = 'http://localhost';

describe('cors middleware', () => {
  let app: Eva;

  beforeEach(() => {
    app = new Eva();
  });

  const request = (origin?: string, method = 'GET') =>
    app.handle(
      new Request(`${BASE}/`, {
        method,
        headers: origin ? { Origin: origin } : {},
      }),
    );

  it("includes Access-Control-Allow-Origin '*' when origin is '*'", async () => {
    app.use(cors({ origin: '*' }));
    app.get('/', (ctx) => ctx.toText('ok'));

    const res = await request('https://example.com');

    expect(res.status).toBe(200);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });

  it('allows a request from the exact configured origin', async () => {
    app.use(cors({ origin: 'https://example.com' }));
    app.get('/', (ctx) => ctx.toText('ok'));

    const res = await request('https://example.com');

    expect(res.status).toBe(200);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(
      'https://example.com',
    );
  });

  it('passes requests without an Origin header through untouched', async () => {
    app.use(cors({ origin: 'https://example.com' }));
    app.get('/', (ctx) => ctx.toText('ok'));

    const res = await request(undefined);

    expect(res.status).toBe(200);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(null);
  });

  it('rejects an origin that is only a substring of the allowed one', async () => {
    app.use(cors({ origin: 'https://evil.com' }));
    app.get('/', (ctx) => ctx.toText('ok'));

    // 'https://evil.com'.includes('https://evil.co') is true — the old
    // substring bug let this through
    const res = await request('https://evil.co');

    expect(res.status).toBe(200);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(null);
  });

  it('allows only exact members of an origin array', async () => {
    app.use(cors({ origin: ['https://a.com', 'https://b.com'] }));
    app.get('/', (ctx) => ctx.toText('ok'));

    const allowed = await request('https://b.com');
    const denied = await request('https://b.com.evil.io');

    expect(allowed.headers.get('Access-Control-Allow-Origin')).toBe(
      'https://b.com',
    );
    expect(denied.headers.get('Access-Control-Allow-Origin')).toBe(null);
  });

  it('answers preflights for an allowed origin without running the handler', async () => {
    const order: string[] = [];
    app.use(cors({ origin: 'https://example.com' }));
    app.options('/', () => {
      order.push('handler');
      return new Response('handler');
    });

    const res = await request('https://example.com', 'OPTIONS');

    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(
      'https://example.com',
    );
    expect(order).toEqual([]);
  });

  it('answers preflights for routes without an OPTIONS handler', async () => {
    // The realistic browser case: preflight an endpoint that only has GET.
    // Requires global middlewares to run BEFORE routing — otherwise the
    // 405 fires before cors() ever sees the request.
    app.use(cors({ origin: '*' }));
    app.get('/users', (ctx) => ctx.toText('ok'));

    const res = await app.handle(
      new Request(`${BASE}/users`, {
        method: 'OPTIONS',
        headers: { Origin: 'https://example.com' },
      }),
    );

    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });

  it("answers preflights with 204 when origin is '*'", async () => {
    app.use(cors({ origin: '*' }));
    app.options('/', (ctx) => ctx.toText('should not run'));

    const res = await request('https://example.com', 'OPTIONS');

    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(await res.text()).toBe('');
  });
});
