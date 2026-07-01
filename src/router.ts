import { EvaConfigError } from './errors';
import type {
  EvaMiddleware,
  EvaRouteOptions,
  Handler,
  MatchResult,
  Method,
  RouteConfig,
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
    config?: RouteConfig,
  ): void {
    if (!route.startsWith('/')) {
      throw new EvaConfigError(`Route ${route} must start with /`);
    }

    const segments = Router.segments(route);

    // Los :x? son azúcar. Los expando en una variante por prefijo
    // (/a/:b?/:c? -> /a, /a/:b, /a/:b/:c) y cada una pasa por el registro
    // normal, así hereda las validaciones.
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
        this.addRoute(method, variant, callback, config);
      }
      return;
    }

    let node = this.routes[method];

    for (const [i, segment] of segments.entries()) {
      if (!segment.startsWith(':') && !segment.startsWith('*')) {
        if (!node.children[segment]) {
          node.children[segment] = { children: {} };
        }
        node = node.children[segment];
      }
      // Una posición solo admite un nombre de param, si no la extracción es ambigua.
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
      // Wildcard solo al final. Es un tercer tipo de hijo, como param.
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

    // Si ya hay handler, peto. Reemplazar en silencio esconde bugs.
    if (node.handler) {
      throw new EvaConfigError(
        `Route ${route} is already registered for ${method}`,
      );
    }

    node.handler = callback as Handler;
    if (config?.middlewares?.length) {
      node.middlewares = config.middlewares;
    }
    if (config?.schemaOptions !== undefined) {
      node.schemaOptions = config.schemaOptions;
    }
  }

  /**
   * Looks up a request path. Returns the handler, the extracted params
   * (raw, NOT percent-decoded — decoding is the HTTP layer's job) and the
   * route-level middlewares collected along the way, or null if nothing
   * matches. Precedence per segment: static > param > wildcard.
   *
   * Middleware scope — INHERITED (Express-style mounting), deliberate policy:
   * a middleware registered on a prefix runs for every route nested under it,
   * static OR dynamic. So `app.get('/users', auth, h)` makes `auth` run for
   * `/users`, `/users/:id`, `/users/:id/posts`, etc. Middlewares accumulate in
   * walk order (outermost first), so an outer prefix's middleware runs before a
   * deeper one's. The only exception is the wildcard fallback: a route reached
   * via `/*` gets only its own middlewares, not those of the abandoned branch.
   */
  match(method: Method, path: string): MatchResult | null {
    const segments = Router.segments(path);
    let node = this.routes[method];
    const params: Record<string, string> = {};
    const middlewares: EvaMiddleware[] = [];

    // Guardo el último wildcard visto y desde qué segmento comería. Si la
    // búsqueda muere más abajo tiro de este. Como solo lo guardo mientras
    // quedan segmentos, /users contra /users/* no lo activa.
    let wildcard: { node: TrieNode; rest: number } | null = null;

    const resolveWildcard = (): MatchResult | null => {
      if (!wildcard?.node.handler) return null;
      // Lo acumulado es de la rama que abandoné, no del wildcard. Reconstruyo.
      return {
        handler: wildcard.node.handler,
        params: { '*': segments.slice(wildcard.rest).join('/') },
        middlewares: wildcard.node.middlewares ?? [],
        schemaOptions: wildcard.node.schemaOptions,
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
        // Un param no coge segmento vacío: /users/ no casa con /:id con id=''.
        params[node.param.name] = segment;
        node = node.param.node;
      } else {
        // Ni estático ni param: el wildcard guardado es la única salida.
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

    return {
      handler: node.handler,
      params,
      middlewares,
      schemaOptions: node.schemaOptions,
    };
  }

  /** Exposes the raw tries. Debug/introspection only — do not mutate. */
  getRoutes(): Record<Method, TrieNode> {
    return this.routes;
  }
}
