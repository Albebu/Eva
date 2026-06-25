import { Eva } from '../eva';
import { serveStatic } from '../static';
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';

// Fixtures live in a temp tree built at startup. Bun.write creates parent
// dirs automatically, so no mkdir. `secret.txt` sits OUTSIDE root, as a
// sibling of it — the traversal test proves it can never be reached.
const base = join(import.meta.dir, 'tmp-static');
const root = join(base, 'public');

describe('serveStatic', () => {
  let app: Eva;

  beforeAll(async () => {
    await Bun.write(join(root, 'index.html'), '<h1>INDEX</h1>');
    await Bun.write(join(root, 'app.js'), 'console.log(1)');
    await Bun.write(join(root, '.env'), 'SECRET=1'); // dotfile, must stay hidden
    await Bun.write(join(base, 'secret.txt'), 'TOPSECRET'); // outside root

    app = new Eva();
    app.get('/static/*', serveStatic(root));
  });

  afterAll(async () => {
    await rm(base, { recursive: true, force: true });
  });

  const get = (path: string) =>
    app.handle(new Request(`http://localhost/static/${path}`));

  it('serves a static file with the right content and content-type', async () => {
    const res = await get('app.js');
    expect(res.status).toBe(200);
    // Bun sets content-type lazily on file-backed responses; reading the
    // body clears it, so assert the header BEFORE consuming the body.
    expect(res.headers.get('content-type')).toContain('javascript');
    expect(await res.text()).toBe('console.log(1)');
  });

  it('serves index.html for the directory root', async () => {
    const res = await get('');
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('<h1>INDEX</h1>');
  });

  it('404s on a missing file', async () => {
    const res = await get('nope.css');
    expect(res.status).toBe(404);
  });

  it('does not serve dotfiles', async () => {
    const res = await get('.env');
    expect(res.status).toBe(404);
    expect(await res.text()).not.toContain('SECRET');
  });

  // %2e%2e%2f == '../' encoded, so the URL parser does NOT collapse it before
  // routing. Eva decodes the wildcard param, then serveStatic's containment
  // check must still reject the escape.
  it('blocks path traversal to a file outside root', async () => {
    const res = await get('%2e%2e%2fsecret.txt');
    expect(res.status).toBe(404);
    expect(await res.text()).not.toContain('TOPSECRET');
  });

  it('blocks deep path traversal', async () => {
    const res = await get('%2e%2e%2f%2e%2e%2fetc%2fpasswd');
    expect(res.status).toBe(404);
  });
});
