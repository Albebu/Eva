import { Eva } from '../eva';
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';

// The only end-to-end test: everything else is covered through handle()
// without touching the network. This one verifies the real-world glue —
// Bun.serve parsing actual HTTP bytes and Eva answering over TCP.
describe('e2e', () => {
  let server: ReturnType<Eva['serve']>;

  beforeAll(() => {
    const app = new Eva();
    app.get('/users/:id', (ctx) => ctx.toJson({ id: ctx.params.id }));

    // Port 0 = "OS, pick any free port" — no collisions with dev servers
    // or parallel CI jobs. serve() returning the server (phase 0) is what
    // lets us read the assigned port back.
    server = app.serve(0);
  });

  afterAll(() => {
    server.stop();
  });

  it('starts, answers a real GET over HTTP and stops cleanly', async () => {
    const res = await fetch(`http://localhost:${server.port}/users/42`);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: '42' });
  });
});
