import { EvaConflictError } from './errors';
import type {
  EvaMiddleware,
  EvaRouteOptions,
  Handler,
  MatchResult,
  Method,
  TrieNode,
} from './types';

// | Router |

export class Router {
  // | Trie |

  private routes: Record<Method, TrieNode> = {
    GET: { children: {} },
    POST: { children: {} },
    PUT: { children: {} },
    PATCH: { children: {} },
    DELETE: { children: {} },
    OPTIONS: { children: {} },
    HEAD: { children: {} },
  };

  // | Add Route |

  addRoute<T extends EvaRouteOptions>(
    method: Method,
    route: string,
    callback: Handler<T>,
    ...middlewares: EvaMiddleware[]
  ): void {
    if (!route.startsWith('/')) {
      throw new Error(`Route ${route} must start with /`);
    }

    const segments = route.split('/').filter(Boolean);
    let node = this.routes[method];

    for (const [i, segment] of segments.entries()) {
      // Static route
      if (!segment.startsWith(':') && !segment.startsWith('*')) {
        if (!node.children[segment]) {
          node.children[segment] = { children: {} };
        }
        node = node.children[segment];
      }
      // Dynamic route
      else if (segment.startsWith(':')) {
        const name = segment.slice(1);
        // Caso en el que ya hay un param y se quiere declarar en la misma ruta pero con un nombre
        // diferente.
        if (node.param && node.param.name !== name) {
          throw new EvaConflictError(
            `Two routes declare different param names at the same position: ${node.param.name} and ${name}`,
          );
        }
        if (!node.param) {
          node.param = { name, node: { children: {} } };
        }
        node = node.param.node;
      }
      // Wildcard route: only valid as the final segment; the wildcard branch
      // is a third kind of child, symmetric with `param`
      else {
        if (i !== segments.length - 1) {
          throw new Error(
            `Invalid route ${route}: wildcard must be the last segment`,
          );
        }
        if (!node.wildcard) {
          node.wildcard = { children: {} };
        }
        node = node.wildcard;
      }
    }

    // Fallar ruidoso en registro: pisar un handler en silencio esconde bugs.
    if (node.handler) {
      throw new Error(`Route ${route} is already registered for ${method}`);
    }

    node.handler = callback as Handler;
    if (middlewares.length > 0) {
      node.middlewares = middlewares;
    }
  }

  match(method: Method, path: string): MatchResult | null {
    const segments = path.split('/').filter(Boolean);
    let node = this.routes[method];
    const params: Record<string, string> = {};
    const middlewares: EvaMiddleware[] = [];

    // Último wildcard visto durante el recorrido y el índice del primer
    // segmento que consumiría. Si la búsqueda fracasa más adelante (en una
    // rama más específica), cae de vuelta a él. Como solo se apunta cuando
    // aún quedan segmentos por consumir, el prefijo pelado (/users contra
    // /users/*) nunca lo activa.
    let wildcard: { node: TrieNode; rest: number } | null = null;

    const resolveWildcard = (): MatchResult | null => {
      if (!wildcard?.node.handler) return null;
      // Los params y middlewares acumulados pertenecen a la rama abandonada,
      // no a la ruta wildcard: se reconstruyen desde cero.
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
      } else if (node.param) {
        params[node.param.name] = segment;
        node = node.param.node;
      } else {
        // Sin hijo estático ni param: el wildcard recordado (que puede ser
        // el de este mismo nivel) es la única salida.
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

  // | Debug |

  getRoutes(): Record<Method, TrieNode> {
    return this.routes;
  }
}
