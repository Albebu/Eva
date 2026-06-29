import { Eva } from '../eva';
import { bodyLimit } from '../body-limit';
import { describe, beforeEach, it, expect } from 'bun:test';

const BASE = 'http://localhost';

describe('bodyLimit middleware', () => {
  let app: Eva;

  beforeEach(() => {
    app = new Eva();
    app.use(bodyLimit(10));
    app.post('/', (ctx) => ctx.toText('ok'));
  });

  const post = (body: string) =>
    app.handle(
      new Request(`${BASE}/`, {
        method: 'POST',
        body,
        headers: { 'Content-Length': String(body.length) },
      }),
    );

  it('rejects a body larger than maxSize with 413', async () => {
    const res = await post('x'.repeat(11));
    expect(res.status).toBe(413);
    expect(res.statusText).toBe('Payload Too Large');
  });

  // Regression: the limit check must NOT consume req.body, or the handler
  // can no longer read it. An earlier version streamed the body to count
  // bytes, which drained it and made ctx.json() throw "body already used"
  // (silent 500). The handler below reads the body AFTER bodyLimit ran.
  it('leaves the body readable for the handler', async () => {
    const guarded = new Eva();
    guarded.use(bodyLimit(1000));
    guarded.post('/', async (ctx) => ctx.toJson(await ctx.json()));

    const res = await guarded.handle(
      new Request(`${BASE}/`, {
        method: 'POST',
        body: JSON.stringify({ hello: 'world' }),
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': '17',
        },
      }),
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ hello: 'world' });
  });

  it('allows a body at or under maxSize', async () => {
    const res = await post('x'.repeat(10));
    expect(res.status).toBe(200);
  });

  it('allows a request with no Content-Length', async () => {
    const res = await app.handle(new Request(`${BASE}/`, { method: 'POST' }));
    expect(res.status).toBe(200);
  });
});
