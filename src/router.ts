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

    for (const segment of segments) {
      if (segment.startsWith(':')) {
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
      } else {
        if (!node.children[segment]) {
          node.children[segment] = { children: {} };
        }
        node = node.children[segment];
      }
    }

    node.handler = callback as Handler;
    if (middlewares.length > 0) {
      node.middlewares = middlewares;
    }
  }

  // | Match |

  match(method: Method, path: string): MatchResult | null {
    const segments = path.split('/').filter(Boolean);
    let node = this.routes[method];
    const params: Record<string, string> = {};
    const middlewares: EvaMiddleware[] = [];

    for (const segment of segments) {
      if (node.children[segment]) {
        node = node.children[segment];
        if (node.middlewares?.length) {
          middlewares.push(...node.middlewares);
        }
      } else if (node.param) {
        params[node.param.name] = segment;
        node = node.param.node;
        if (node.middlewares?.length) {
          middlewares.push(...node.middlewares);
        }
      } else {
        return null;
      }
    }

    if (!node.handler) return null;

    return { handler: node.handler, params, middlewares };
  }

  // | Debug |

  getRoutes(): Record<Method, TrieNode> {
    return this.routes;
  }
}
