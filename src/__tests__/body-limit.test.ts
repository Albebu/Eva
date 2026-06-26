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
    console.log(res);
    expect(res.status).toBe(413);
    expect(res.statusText).toBe('Payload Too Large');
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
