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
   * Known limitations (see roadmap): route-level middlewares and wildcard
   * branches are not copied yet.
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
        parent._router.addRoute(method, fullPath, node.handler);
      }
      for (const [segment, child] of Object.entries(node.children)) {
        copyRoutes(method, child, `${path}/${segment}`);
      }

      if (node.param) {
        copyRoutes(method, node.param.node, `${path}/:${node.param.name}`);
      }
    }
  }

  /**
   * Registers a global middleware. They run on every request, in
   * registration order, before any route middleware and the handler.
   * A middleware must `await next()` to continue the chain.
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

  /** Registers a GET route. Optional second argument: route middlewares. */
  get<T extends EvaRouteOptions>(route: string, handler: Handler<T>): Eva;
  get<T extends EvaRouteOptions>(
    route: string,
    middlewares: EvaMiddleware[],
    handler: Handler<T>,
  ): Eva;
  get<T extends EvaRouteOptions>(
    route: string,
    ...args: [Handler<T>] | [EvaMiddleware[], Handler<T>]
  ): Eva {
    if (Array.isArray(args[0])) {
      const [middlewares, handler] = args as [EvaMiddleware[], Handler<T>];
      this._router.addRoute('GET', route, handler, ...middlewares);
    } else {
      const [handler] = args as [Handler<T>];
      this._router.addRoute('GET', route, handler);
    }
    return this;
  }

  /** Registers a POST route. Optional second argument: route middlewares. */
  post<T extends EvaRouteOptions>(route: string, handler: Handler<T>): Eva;
  post<T extends EvaRouteOptions>(
    route: string,
    middlewares: EvaMiddleware[],
    handler: Handler<T>,
  ): Eva;
  post<T extends EvaRouteOptions>(
    route: string,
    ...args: [Handler<T>] | [EvaMiddleware[], Handler<T>]
  ): Eva {
    if (Array.isArray(args[0])) {
      const [middlewares, handler] = args as [EvaMiddleware[], Handler<T>];
      this._router.addRoute('POST', route, handler, ...middlewares);
    } else {
      const [handler] = args as [Handler<T>];
      this._router.addRoute('POST', route, handler);
    }
    return this;
  }

  /** Registers a PUT route. Optional second argument: route middlewares. */
  put<T extends EvaRouteOptions>(route: string, handler: Handler<T>): Eva;
  put<T extends EvaRouteOptions>(
    route: string,
    middlewares: EvaMiddleware[],
    handler: Handler<T>,
  ): Eva;
  put<T extends EvaRouteOptions>(
    route: string,
    ...args: [Handler<T>] | [EvaMiddleware[], Handler<T>]
  ): Eva {
    if (Array.isArray(args[0])) {
      const [middlewares, handler] = args as [EvaMiddleware[], Handler<T>];
      this._router.addRoute('PUT', route, handler, ...middlewares);
    } else {
      const [handler] = args as [Handler<T>];
      this._router.addRoute('PUT', route, handler);
    }
    return this;
  }

  /** Registers a PATCH route. Optional second argument: route middlewares. */
  patch<T extends EvaRouteOptions>(route: string, handler: Handler<T>): Eva;
  patch<T extends EvaRouteOptions>(
    route: string,
    middlewares: EvaMiddleware[],
    handler: Handler<T>,
  ): Eva;
  patch<T extends EvaRouteOptions>(
    route: string,
    ...args: [Handler<T>] | [EvaMiddleware[], Handler<T>]
  ): Eva {
    if (Array.isArray(args[0])) {
      const [middlewares, handler] = args as [EvaMiddleware[], Handler<T>];
      this._router.addRoute('PATCH', route, handler, ...middlewares);
    } else {
      const [handler] = args as [Handler<T>];
      this._router.addRoute('PATCH', route, handler);
    }
    return this;
  }

  /** Registers a DELETE route. Optional second argument: route middlewares. */
  delete<T extends EvaRouteOptions>(route: string, handler: Handler<T>): Eva;
  delete<T extends EvaRouteOptions>(
    route: string,
    middlewares: EvaMiddleware[],
    handler: Handler<T>,
  ): Eva;
  delete<T extends EvaRouteOptions>(
    route: string,
    ...args: [Handler<T>] | [EvaMiddleware[], Handler<T>]
  ): Eva {
    if (Array.isArray(args[0])) {
      const [middlewares, handler] = args as [EvaMiddleware[], Handler<T>];
      this._router.addRoute('DELETE', route, handler, ...middlewares);
    } else {
      const [handler] = args as [Handler<T>];
      this._router.addRoute('DELETE', route, handler);
    }
    return this;
  }

  /** Registers an OPTIONS route. Optional second argument: route middlewares. */
  options<T extends EvaRouteOptions>(route: string, handler: Handler<T>): Eva;
  options<T extends EvaRouteOptions>(
    route: string,
    middlewares: EvaMiddleware[],
    handler: Handler<T>,
  ): Eva;
  options<T extends EvaRouteOptions>(
    route: string,
    ...args: [Handler<T>] | [EvaMiddleware[], Handler<T>]
  ): Eva {
    if (Array.isArray(args[0])) {
      const [middlewares, handler] = args as [EvaMiddleware[], Handler<T>];
      this._router.addRoute('OPTIONS', route, handler, ...middlewares);
    } else {
      const [handler] = args as [Handler<T>];
      this._router.addRoute('OPTIONS', route, handler);
    }
    return this;
  }

  /**
   * Fluent builder to group several methods on one path:
   *
   * ```ts
   * app.route('/tasks').get(listTasks).post(createTask);
   * ```
   *
   * The `<verb>With(middlewares, handler)` variants register route-level
   * middlewares for that method.
   */
  route<T extends EvaRouteOptions>(route: string) {
    const self = this;
    return {
      get(handler: Handler<T>) {
        self._router.addRoute('GET', route, handler);
        return this;
      },
      getWith(middlewares: EvaMiddleware[], handler: Handler<T>) {
        self._router.addRoute('GET', route, handler, ...middlewares);
        return this;
      },
      post(handler: Handler<T>) {
        self._router.addRoute('POST', route, handler);
        return this;
      },
      postWith(middlewares: EvaMiddleware[], handler: Handler<T>) {
        self._router.addRoute('POST', route, handler, ...middlewares);
        return this;
      },
      put(handler: Handler<T>) {
        self._router.addRoute('PUT', route, handler);
        return this;
      },
      putWith(middlewares: EvaMiddleware[], handler: Handler<T>) {
        self._router.addRoute('PUT', route, handler, ...middlewares);
        return this;
      },
      patch(handler: Handler<T>) {
        self._router.addRoute('PATCH', route, handler);
        return this;
      },
      patchWith(middlewares: EvaMiddleware[], handler: Handler<T>) {
        self._router.addRoute('PATCH', route, handler, ...middlewares);
        return this;
      },
      delete(handler: Handler<T>) {
        self._router.addRoute('DELETE', route, handler);
        return this;
      },
      deleteWith(middlewares: EvaMiddleware[], handler: Handler<T>) {
        self._router.addRoute('DELETE', route, handler, ...middlewares);
        return this;
      },
      options(handler: Handler<T>) {
        self._router.addRoute('OPTIONS', route, handler);
        return this;
      },
      optionsWith(middlewares: EvaMiddleware[], handler: Handler<T>) {
        self._router.addRoute('OPTIONS', route, handler, ...middlewares);
        return this;
      },
    };
  }

  /**
   * The whole framework as a pure function: Request in, Response out.
   *
   * Pipeline: parse query -> route match (404/405 if none) -> percent-decode
   * params -> global middlewares -> route middlewares -> handler -> error
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
          if (m !== methodToSearch) {
            const found = this._router.match(m, path);
            if (found) {
              availableMethods.push(m);
            }
          }
        }

        if (availableMethods.length > 0) {
          return new Response('Not Allowed', {
            status: 405,
            headers: {
              Allow: availableMethods.join(', '),
              'Content-Type': 'text/plain',
            },
          });
        }

        return ctx.notFound();
      }

      try {
        ctx.params = Object.fromEntries(
          Object.entries(match.params).map(([key, value]) => [
            key,
            decodeURIComponent(value),
          ]),
        );
      } catch (error) {
        throw new EvaBadRequestError('Malformed URL encoding');
      }

      const handler = match.handler;
      const allMiddleware = [...this._globalMiddleware, ...match.middlewares];

      let response: Response | undefined;

      const runChain = async (index: number): Promise<void> => {
        if (index < allMiddleware.length) {
          const middleware = allMiddleware[index]!;
          await middleware(ctx, () => runChain(index + 1));
        } else {
          response = await handler(ctx);
        }
      };

      await runChain(0);

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
   * return value for `server.port` (pass port 0 for a random free one)
   * and `server.stop()`.
   */
  serve(port?: number, callback?: () => void): Bun.Server<unknown> {
    return Bun.serve({
      port: port ?? 9999, //TODO: Poner el puerto 3000 por defecto.
      fetch: async (req) => this.handle(req),
      ...(callback ? { onListen: callback } : {}), //TODO: No funciona el callback
    });
  }
}
