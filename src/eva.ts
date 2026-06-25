import { EvaBadRequestError, EvaError, EvaInternalServerError } from './errors';
import { EvaContext } from './eva-context';
import { Router } from './router';
import { methods } from './shared';
import type {
  ErrorHandler,
  EvaMiddleware,
  EvaRouteOptions,
  Handler,
  Method,
  TrieNode,
} from './types';

/**
 * Fluent registrar returned by `Eva.route()`. Object literals cannot carry
 * overload signatures, so they live here and the implementation uses a
 * union-args function typed against this interface.
 */
export interface RouteBuilder<T extends EvaRouteOptions = {}> {
  get(handler: Handler<T>): RouteBuilder<T>;
  get(middlewares: EvaMiddleware[], handler: Handler<T>): RouteBuilder<T>;
  post(handler: Handler<T>): RouteBuilder<T>;
  post(middlewares: EvaMiddleware[], handler: Handler<T>): RouteBuilder<T>;
  put(handler: Handler<T>): RouteBuilder<T>;
  put(middlewares: EvaMiddleware[], handler: Handler<T>): RouteBuilder<T>;
  patch(handler: Handler<T>): RouteBuilder<T>;
  patch(middlewares: EvaMiddleware[], handler: Handler<T>): RouteBuilder<T>;
  delete(handler: Handler<T>): RouteBuilder<T>;
  delete(middlewares: EvaMiddleware[], handler: Handler<T>): RouteBuilder<T>;
  options(handler: Handler<T>): RouteBuilder<T>;
  options(middlewares: EvaMiddleware[], handler: Handler<T>): RouteBuilder<T>;
}

export class Eva {
  private _router: Router;
  private _globalMiddleware: EvaMiddleware[] = [];
  private _errorHandler?: ErrorHandler;

  constructor() {
    this._router = new Router();
  }

  /**
   * Mounts this instance's routes into `parent` under a prefix:
   *
   * ```ts
   * const users = new Eva();
   * users.get('/users/:id', handler);
   * users.toParent(app, '/api/v1'); // -> GET /api/v1/users/:id
   * ```
   *
   * Handlers, route-level middlewares and wildcard branches are all copied.
   *
   * TODO(design): consider inverting to Express-style `parent.mount(prefix,
   * child)` in phase 4.
   */
  toParent(parent: Eva, prefix: string = ''): void {
    for (const m of methods) {
      copyRoutes(m, this._router.getRoutes()[m], '');
    }

    function copyRoutes(method: Method, node: TrieNode, path: string) {
      if (node?.handler) {
        const fullPath = prefix + (path ?? '/');
        parent._router.addRoute(
          method,
          fullPath,
          node.handler,
          ...(node.middlewares ?? []),
        );
      }
      for (const [segment, child] of Object.entries(node.children)) {
        copyRoutes(method, child, `${path}/${segment}`);
      }

      if (node.param) {
        copyRoutes(method, node.param.node, `${path}/:${node.param.name}`);
      }

      if (node.wildcard) {
        copyRoutes(method, node.wildcard, `${path}/*`);
      }
    }
  }

  /**
   * Registers a global middleware. They run on EVERY request — including
   * ones that end in 404/405 — in registration order, BEFORE routing
   * (Express-style). Because routing has not happened yet, ctx.params is
   * empty inside global middlewares. A middleware must `await next()` to
   * continue the chain, and may return a Response to answer the request
   * itself.
   */
  use(middleware: EvaMiddleware): Eva {
    this._globalMiddleware.push(middleware);
    return this;
  }

  /**
   * Registers the handler for errors that are NOT EvaError instances
   * (those map to their own status automatically). Without it, unknown
   * errors become a generic 500 with no detail leaked to the client.
   */
  onError(handler: ErrorHandler): Eva {
    this._errorHandler = handler;
    return this;
  }

  private makeRoute<T extends EvaRouteOptions>(
    method: Method,
    route: string,
    ...args: [Handler<T>] | [EvaMiddleware[], Handler<T>]
  ): Eva {
    if (Array.isArray(args[0])) {
      const [middlewares, handler] = args as [EvaMiddleware[], Handler<T>];
      this._router.addRoute(method, route, handler, ...middlewares);
    } else {
      const [handler] = args as [Handler<T>];
      this._router.addRoute(method, route, handler);
    }
    return this;
  }

  /** Registers a GET route. Optional second argument: route middlewares. */
  get<T extends EvaRouteOptions>(
    route: string,
    ...args: [Handler<T>] | [EvaMiddleware[], Handler<T>]
  ): Eva {
    return this.makeRoute('GET', route, ...args);
  }

  /** Registers a POST route. Optional second argument: route middlewares. */
  post<T extends EvaRouteOptions>(
    route: string,
    ...args: [Handler<T>] | [EvaMiddleware[], Handler<T>]
  ): Eva {
    return this.makeRoute('POST', route, ...args);
  }

  /** Registers a PUT route. Optional second argument: route middlewares. */
  put<T extends EvaRouteOptions>(
    route: string,
    ...args: [Handler<T>] | [EvaMiddleware[], Handler<T>]
  ): Eva {
    return this.makeRoute('PUT', route, ...args);
  }

  /** Registers a PATCH route. Optional second argument: route middlewares. */
  patch<T extends EvaRouteOptions>(
    route: string,
    ...args: [Handler<T>] | [EvaMiddleware[], Handler<T>]
  ): Eva {
    return this.makeRoute('PATCH', route, ...args);
  }

  /** Registers a DELETE route. Optional second argument: route middlewares. */
  delete<T extends EvaRouteOptions>(
    route: string,
    ...args: [Handler<T>] | [EvaMiddleware[], Handler<T>]
  ): Eva {
    return this.makeRoute('DELETE', route, ...args);
  }

  /** Registers an OPTIONS route. Optional second argument: route middlewares. */
  options<T extends EvaRouteOptions>(
    route: string,
    ...args: [Handler<T>] | [EvaMiddleware[], Handler<T>]
  ): Eva {
    return this.makeRoute('OPTIONS', route, ...args);
  }

  /**
   * Fluent builder to group several methods on one path. Every verb mirrors
   * the top-level API: an optional middlewares array before the handler.
   *
   * ```ts
   * app
   *   .route('/tasks')
   *   .get(listTasks)
   *   .post([requireAuth], createTask);
   * ```
   */
  route<T extends EvaRouteOptions>(route: string): RouteBuilder<T> {
    const makeMethod = (method: Method) => {
      return (
        ...args: [Handler<T>] | [EvaMiddleware[], Handler<T>]
      ): RouteBuilder<T> => {
        if (Array.isArray(args[0])) {
          const [middlewares, handler] = args as [EvaMiddleware[], Handler<T>];
          this._router.addRoute(method, route, handler, ...middlewares);
        } else {
          const [handler] = args as [Handler<T>];
          this._router.addRoute(method, route, handler);
        }
        return builder;
      };
    };

    const builder: RouteBuilder<T> = {
      get: makeMethod('GET'),
      post: makeMethod('POST'),
      put: makeMethod('PUT'),
      patch: makeMethod('PATCH'),
      delete: makeMethod('DELETE'),
      options: makeMethod('OPTIONS'),
    };

    return builder;
  }

  /**
   * The whole framework as a pure function: Request in, Response out.
   *
   * Pipeline: parse query -> global middlewares -> route match (404/405 if
   * none) -> percent-decode params -> route middlewares -> handler -> error
   * boundary (EvaError -> its status; anything else -> onError or a generic
   * 500 that leaks no detail).
   *
   * `serve()` plugs this into a real socket; tests call it directly with a
   * `new Request(...)` and never need to bind a port.
   */
  async handle(req: Request): Promise<Response> {
    const ctx = new EvaContext(req);
    const url = new URL(req.url);
    const method = req.method as Method;
    const path = url.pathname;

    const query: Record<string, string> = {};
    for (const [key, value] of url.searchParams) {
      query[key] = value;
    }
    ctx.query = query;

    try {
      let response: Response | undefined;

      // Generic chain runner: walks `chain` and calls `tail` at the end.
      // A middleware that returns a Response sets it — short-circuit when
      // it skipped next(), override when it ran the chain first.
      const runChain = async (
        chain: EvaMiddleware[],
        tail: () => Promise<void>,
      ): Promise<void> => {
        const run = async (index: number): Promise<void> => {
          if (index < chain.length) {
            const result = await chain[index]!(ctx, () => run(index + 1));
            if (result !== undefined) {
              response = result;
            }
          } else {
            await tail();
          }
        };
        await run(0);
      };

      // Routing is the LAST station of the global chain (Express-style):
      // every request crosses every global middleware first, so things
      // like CORS preflights work even for unmatched routes. This also
      // means ctx.params is not populated yet inside global middlewares.
      const dispatch = async (): Promise<void> => {
        const methodToSearch: Method = method === 'HEAD' ? 'GET' : method;
        const match = this._router.match(methodToSearch, path);

        if (!match) {
          const methodsToSearch: Method[] = [
            'GET',
            'POST',
            'PUT',
            'PATCH',
            'DELETE',
          ];
          const availableMethods: string[] = [];

          for (const m of methodsToSearch) {
            if (m !== methodToSearch && this._router.match(m, path)) {
              availableMethods.push(m);
            }
          }

          response =
            availableMethods.length > 0
              ? new Response('Not Allowed', {
                  status: 405,
                  headers: {
                    Allow: availableMethods.join(', '),
                    'Content-Type': 'text/plain',
                  },
                })
              : ctx.notFound();
          return;
        }

        try {
          ctx.params = Object.fromEntries(
            Object.entries(match.params).map(([key, value]) => [
              key,
              decodeURIComponent(value),
            ]),
          );
        } catch {
          throw new EvaBadRequestError('Malformed URL encoding');
        }

        await runChain(match.middlewares, async () => {
          response = await match.handler(ctx);
        });
      };

      await runChain(this._globalMiddleware, dispatch);

      if (method === 'HEAD') {
        return new Response(null, {
          status: response?.status,
          headers: response?.headers,
        });
      }

      if (response === undefined) {
        throw new EvaInternalServerError();
      }

      return response;
    } catch (error) {
      if (error instanceof EvaError) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: error.statusCode,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (this._errorHandler) {
        return this._errorHandler(error, ctx);
      }
      return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  /**
   * Starts a Bun server backed by `handle()` and returns it — use the
   * return value for `server.port` (pass port 0 for a random free one),
   * port 3000 is the default if none is provided.
   * Call `server.stop()` to stop the server.
   */
  serve(port?: number, callback?: () => void): Bun.Server<unknown> {
    const server = Bun.serve({
      port: port ?? 3000,
      fetch: async (req) => this.handle(req),
    });
    callback?.();
    return server;
  }
}
