import { Router } from '../router';
import { describe, beforeEach, it, expect, test } from 'bun:test';
import { EvaConflictError } from '../errors';
import type { EvaMiddleware } from '../types';

const makeHandler = () => () => new Response('ok');

describe('Router', () => {
  let router: Router;

  beforeEach(() => {
    router = new Router();
  });

  describe('addRoute', () => {
    it('throws when the route does not start with /', () => {
      expect(() => router.addRoute('GET', 'users/me', makeHandler())).toThrow(
        'must start with /',
      );
    });

    it('throws EvaConflictError when two routes declare different param names at the same position', () => {
      router.addRoute('GET', '/users/:id', makeHandler());
      expect(() =>
        router.addRoute('GET', '/users/:userId/posts', makeHandler()),
      ).toThrow(EvaConflictError);
    });
  });

  describe('match — static routes', () => {
    it('matches an exact static route and returns its handler', () => {
      const handler = makeHandler();
      router.addRoute('GET', '/users', handler);

      const match = router.match('GET', '/users');

      expect(match?.handler).toBe(handler);
    });

    it('matches the root route /', () => {
      const handler = makeHandler();
      router.addRoute('GET', '/', handler);

      const match = router.match('GET', '/');

      expect(match?.handler).toBe(handler);
    });

    it('matches a deep static route', () => {
      const handler = makeHandler();
      router.addRoute('GET', '/api/v1/users', handler);

      const match = router.match('GET', '/api/v1/users');

      expect(match?.handler).toBe(handler);
    });

    it('returns null for an unregistered path', () => {
      router.addRoute('GET', '/users', makeHandler());

      expect(router.match('GET', '/posts')).toBeNull();
    });

    // TODO: Change to return the allowed methods
    it('returns null when the path is registered for a different method', () => {
      router.addRoute('GET', '/users', makeHandler());

      expect(router.match('POST', '/users')).toBeNull();
    });
  });

  describe('match — param routes', () => {
    it('extracts a single param', () => {
      const handler = makeHandler();
      router.addRoute('GET', '/users/:id', handler);

      const match = router.match('GET', '/users/1');

      expect(match?.handler).toBe(handler);
      expect(match?.params).toEqual({ id: '1' });
    });

    it('extracts multiple params', () => {
      const handler = makeHandler();
      router.addRoute('GET', '/users/:userId/posts/:postId', handler);

      const match = router.match('GET', '/users/1/posts/2');

      expect(match?.handler).toBe(handler);
      expect(match?.params).toEqual({ userId: '1', postId: '2' });
    });

    it('returns null for a partial path', () => {
      router.addRoute('GET', '/users/:id', makeHandler());

      expect(router.match('GET', '/users')).toBeNull();
    });

    it('returns null when the path has extra segments beyond the route', () => {
      router.addRoute('GET', '/users/:id', makeHandler());

      expect(router.match('GET', '/users/1/posts/2')).toBeNull();
    });

    it('static route wins over param route at the same position', () => {
      const staticHandler = makeHandler();
      const paramHandler = makeHandler();
      router.addRoute('GET', '/users/me', staticHandler);
      router.addRoute('GET', '/users/:id', paramHandler);

      const match = router.match('GET', '/users/me');

      expect(match?.handler).toBe(staticHandler);
      expect(match?.params).toEqual({});
    });
  });

  describe('match - wildcard routes', () => {
    it('should capture a route that falls in wildcard', () => {
      const handler = makeHandler();
      router.addRoute('GET', '/users/*', handler);
      const match = router.match('GET', '/users/a');

      expect(match?.handler).toBe(handler);
    });
    it('should match a deep route with the wildcard', () => {
      const handler = makeHandler();
      router.addRoute('GET', '/users/*', handler);
      const match = router.match('GET', '/users/a/b/c');

      expect(match?.handler).toBe(handler);
    });

    it('captures the rest of the path under params["*"]', () => {
      router.addRoute('GET', '/users/*', makeHandler());

      const match = router.match('GET', '/users/a/b/c');

      expect(match?.params).toEqual({ '*': 'a/b/c' });
    });

    it('static route wins over wildcard at the same position', () => {
      const staticHandler = makeHandler();
      const wildcardHandler = makeHandler();
      router.addRoute('GET', '/users/me', staticHandler);
      router.addRoute('GET', '/users/*', wildcardHandler);

      expect(router.match('GET', '/users/me')?.handler).toBe(staticHandler);
      expect(router.match('GET', '/users/other')?.handler).toBe(
        wildcardHandler,
      );
    });

    it('param route wins over wildcard at the same position', () => {
      const paramHandler = makeHandler();
      const wildcardHandler = makeHandler();
      router.addRoute('GET', '/users/:id', paramHandler);
      router.addRoute('GET', '/users/*', wildcardHandler);

      const match = router.match('GET', '/users/42');

      expect(match?.handler).toBe(paramHandler);
      expect(match?.params).toEqual({ id: '42' });
    });

    it('falls back to the wildcard when a more specific branch dead-ends', () => {
      const staticHandler = makeHandler();
      const wildcardHandler = makeHandler();
      router.addRoute('GET', '/users/me', staticHandler);
      router.addRoute('GET', '/users/*', wildcardHandler);

      // walks into the static 'me' branch, dead-ends at 'settings',
      // and must remember the wildcard seen at the 'users' level
      const match = router.match('GET', '/users/me/settings');

      expect(match?.handler).toBe(wildcardHandler);
      expect(match?.params).toEqual({ '*': 'me/settings' });
    });

    it('throws when the wildcard is not the last segment', () => {
      expect(() =>
        router.addRoute('GET', '/users/*/posts', makeHandler()),
      ).toThrow('wildcard must be the last segment');
    });

    it('does not match the bare prefix (wildcard requires a non-empty rest)', () => {
      router.addRoute('GET', '/users/*', makeHandler());

      expect(router.match('GET', '/users')).toBeNull();
    });
  });

  describe('match — path normalization', () => {
    test.each([
      ['/users/', 'trailing slash'],
      ['//users', 'double slashes'],
    ])('%s resolves to the same route as /users (%s)', (path) => {
      const handler = makeHandler();
      router.addRoute('GET', '/users', handler);

      expect(router.match('GET', path)?.handler).toBe(handler);
    });
  });

  describe('match — middlewares', () => {
    it('returns route-level middlewares in the match result', () => {
      const middleware: EvaMiddleware = (_ctx, next) => next();
      router.addRoute('GET', '/users', makeHandler(), middleware);

      const match = router.match('GET', '/users');

      expect(match?.middlewares).toEqual([middleware]);
    });
  });
});
