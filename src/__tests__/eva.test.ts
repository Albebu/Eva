import { Eva } from '../eva';
import { describe, beforeEach, it, expect } from 'bun:test';

const BASE = 'http://localhost';

function req(path: string, method = 'GET'): Request {
  return new Request(`${BASE}${path}`, { method });
}

describe('Eva', () => {
  let app: Eva;

  beforeEach(() => {
    app = new Eva();
  });

  it('route params are percent-decoded before reaching the handler', async () => {
    app.get('/users/:id', (ctx) => ctx.toJson(ctx.params));

    const res = await app.handle(req('/users/a%20b'));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: 'a b' });
  });
});
