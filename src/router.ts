import { EvaConfigError } from './errors';
import type {
  EvaMiddleware,
  EvaRouteOptions,
  Handler,
  MatchResult,
  Method,
  TrieNode,
} from './types';

/**
 * Trie-based router: one prefix tree per HTTP method. Each node can have
 * three kinds of children, tried in this order on lookup:
 *
 * 1. `children` — static segments (`/users`)
 * 2. `param`    — one named dynamic segment (`/:id`)
 * 3. `wildcard` — consumes the rest of the path (`/*`)
 *
 * The router is a pure data structure: it knows nothing about HTTP
 * requests or responses. Registration mistakes throw EvaConfigError so
 * they crash at startup, never mid-request.
 *
 * Matching is STRICT (Fastify/Hono-style): '/users/' and '/users' are
 * different routes, and a param never captures an empty segment.
 */
export class Router {
  /**
   * Strict segmentation (deliberate policy, Fastify/Hono-style): every
   * slash is meaningful, so '/users/' produces ['users', ''] and does NOT
   * equal '/users' (['users']). The only special case is the root path.
   */
  private static segments(path: string): string[] {
    if (path === '/') return [];
    return path.slice(1).split('/');
  }

  private routes: Record<Method, TrieNode> = {
    GET: { children: {} },
    POST: { children: {} },
    PUT: { children: {} },
    PATCH: { children: {} },
    DELETE: { children: {} },
    OPTIONS: { children: {} },
    HEAD: { children: {} },
  };

  /**
   * Registers a route pattern for a method. Supported segments: static
   * (`/users`), named params (`/:id`), trailing optional params (`/:id?`)
   * and a trailing wildcard (`/*`).
   *
   * Fail-fast policy: invalid patterns, conflicting param names and
   * duplicate registrations throw EvaConfigError at registration time.
   */
  addRoute<T extends EvaRouteOptions>(
    method: Method,
    route: string,
    callback: Handler<T>,
    ...middlewares: EvaMiddleware[]
  ): void {
    if (!route.startsWith('/')) {
      throw new EvaConfigError(`Route ${route} must start with /`);
    }

    const segments = Router.segments(route);

    // Optional params (:x?) are syntactic sugar: they desugar into one
    // variant per valid prefix (/a/:b?/:c? -> /a, /a/:b, /a/:b/:c), and
    // each variant goes through the normal registration path, inheriting
    // every validation (name conflicts, duplicates...).
    const isOptional = (s: string) => s.startsWith(':') && s.endsWith('?');
    const firstOptional = segments.findIndex(isOptional);

    if (firstOptional !== -1) {
      if (!segments.slice(firstOptional).every(isOptional)) {
        throw new EvaConfigError(
          `Invalid route ${route}: optional params must be trailing`,
        );
      }
      for (let end = firstOptional; end <= segments.length; end++) {
        const variant =
          '/' +
          segments
            .slice(0, end)
            .map((s) => (isOptional(s) ? s.slice(0, -1) : s))
            .join('/');
        this.addRoute(method, variant, callback, ...middlewares);
      }
      return;
    }

    let node = this.routes[method];

    for (const [i, segment] of segments.entries()) {
      // Static segment
      if (!segment.startsWith(':') && !segment.startsWith('*')) {
        if (!node.children[segment]) {
          node.children[segment] = { children: {} };
        }
        node = node.children[segment];
      }
      // Named param — a position can hold only ONE param name across all
      // routes; allowing two would make extraction ambiguous.
      else if (segment.startsWith(':')) {
        const name = segment.slice(1);
        if (node.param && node.param.name !== name) {
          throw new EvaConfigError(
            `Two routes declare different param names at the same position: ${node.param.name} and ${name}`,
          );
        }
        if (!node.param) {
          node.param = { name, node: { children: {} } };
        }
        node = node.param.node;
      }
      // Wildcard — only valid as the final segment; the wildcard branch is
      // a third kind of child, symmetric with `param`.
      else {
        if (i !== segments.length - 1) {
          throw new EvaConfigError(
            `Invalid route ${route}: wildcard must be the last segment`,
          );
        }
        if (!node.wildcard) {
          node.wildcard = { children: {} };
        }
        node = node.wildcard;
      }
    }

    // Fail loudly on duplicates: silently replacing a handler hides bugs.
    if (node.handler) {
      throw new EvaConfigError(
        `Route ${route} is already registered for ${method}`,
      );
    }

    node.handler = callback as Handler;
    if (middlewares.length > 0) {
      node.middlewares = middlewares;
    }
  }

  /**
   * Looks up a request path. Returns the handler, the extracted params
   * (raw, NOT percent-decoded — decoding is the HTTP layer's job) and the
   * route-level middlewares collected along the way, or null if nothing
   * matches. Precedence per segment: static > param > wildcard.
   */
  match(method: Method, path: string): MatchResult | null {
    const segments = Router.segments(path);
    let node = this.routes[method];
    const params: Record<string, string> = {};
    const middlewares: EvaMiddleware[] = [];

    // Last wildcard seen during the walk, plus the index of the first
    // segment it would consume. If the search dead-ends deeper (in a more
    // specific branch), it falls back to this. Because it is only recorded
    // while segments remain to be consumed, a bare prefix (/users against
    // /users/*) can never activate it.
    let wildcard: { node: TrieNode; rest: number } | null = null;

    const resolveWildcard = (): MatchResult | null => {
      if (!wildcard?.node.handler) return null;
      // Params and middlewares accumulated so far belong to the abandoned
      // branch, not to the wildcard route: rebuild from scratch.
      return {
        handler: wildcard.node.handler,
        params: { '*': segments.slice(wildcard.rest).join('/') },
        middlewares: wildcard.node.middlewares ?? [],
      };
    };

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i]!;

      if (node.wildcard) {
        wildcard = { node: node.wildcard, rest: i };
      }

      if (node.children[segment]) {
        node = node.children[segment];
      } else if (node.param && segment !== '') {
        // A param never captures an empty segment: under strict matching,
        // '/users/' must not match '/users/:id' with id = ''.
        params[node.param.name] = segment;
        node = node.param.node;
      } else {
        // No static child and no param: the remembered wildcard (possibly
        // the one at this very level) is the only way out.
        return resolveWildcard();
      }

      if (node.middlewares?.length) {
        middlewares.push(...node.middlewares);
      }
    }

    if (!node.handler) return resolveWildcard();

    if (segments.length === 0 && node.middlewares?.length) {
      middlewares.push(...node.middlewares);
    }

    return { handler: node.handler, params, middlewares };
  }

  /** Exposes the raw tries. Debug/introspection only — do not mutate. */
  getRoutes(): Record<Method, TrieNode> {
    return this.routes;
  }
}
