import { Eva } from '../eva';
import { describe, beforeEach, it, expect } from 'bun:test';

const BASE = 'http://localhost';

describe('request cookies', () => {
  let app: Eva;

  beforeEach(() => {
    app = new Eva();
    app.get('/', (ctx) => ctx.toJson(ctx.getCookies()));
  });

  const get = (cookie?: string) =>
    app.handle(
      new Request(`${BASE}/`, { headers: cookie ? { Cookie: cookie } : {} }),
    );

  it('parses multiple cookies', async () => {
    const res = await get('a=1; b=2');
    expect(await res.json()).toEqual({ a: '1', b: '2' });
  });

  it('returns an empty object when there is no Cookie header', async () => {
    const res = await get();
    expect(await res.json()).toEqual({});
  });

  it('percent-decodes values', async () => {
    const res = await get('x=a%20b');
    expect(await res.json()).toEqual({ x: 'a b' });
  });

  it('does not truncate a value containing "="', async () => {
    const res = await get('t=YWJj==');
    expect(await res.json()).toEqual({ t: 'YWJj==' });
  });

  it('skips malformed pairs with no "="', async () => {
    const res = await get('a=1; garbage; b=2');
    expect(await res.json()).toEqual({ a: '1', b: '2' });
  });
});

describe('response cookies (setCookie)', () => {
  let app: Eva;

  beforeEach(() => {
    app = new Eva();
  });

  const get = () => app.handle(new Request(`${BASE}/`));

  it('sets a cookie with no options as bare name=value', async () => {
    app.get('/', (ctx) => {
      ctx.setCookie({ name: 'sid', value: 'abc' });
      return ctx.toText('ok');
    });
    const res = await get();
    expect(res.headers.getSetCookie()).toEqual(['sid=abc']);
  });

  it('emits one Set-Cookie header per cookie', async () => {
    app.get('/', (ctx) => {
      ctx.setCookie({ name: 'a', value: '1' });
      ctx.setCookie({ name: 'b', value: '2' });
      return ctx.toText('ok');
    });
    const res = await get();
    expect(res.headers.getSetCookie()).toEqual(['a=1', 'b=2']);
  });

  it('serializes attributes', async () => {
    app.get('/', (ctx) => {
      ctx.setCookie({
        name: 'sid',
        value: 'abc',
        options: {
          path: '/',
          domain: 'example.com',
          secure: true,
          httpOnly: true,
        },
      });
      return ctx.toText('ok');
    });
    const res = await get();
    expect(res.headers.getSetCookie()).toEqual([
      'sid=abc; Path=/; Domain=example.com; Secure; HttpOnly',
    ]);
  });

  it('serializes Expires from a Date', async () => {
    const expires = new Date('2030-01-01T00:00:00Z');
    app.get('/', (ctx) => {
      ctx.setCookie({ name: 'sid', value: 'abc', options: { expires } });
      return ctx.toText('ok');
    });
    const res = await get();
    expect(res.headers.getSetCookie()).toEqual([
      `sid=abc; Expires=${expires.toUTCString()}`,
    ]);
  });

  it('percent-encodes the value', async () => {
    app.get('/', (ctx) => {
      ctx.setCookie({ name: 'x', value: 'a b' });
      return ctx.toText('ok');
    });
    const res = await get();
    expect(res.headers.getSetCookie()).toEqual(['x=a%20b']);
  });
});
