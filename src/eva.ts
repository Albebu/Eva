import { EvaBadRequestError, EvaError, EvaInternalServerError } from './errors';
import { EvaContext } from './eva-context';
import { Router } from './router';
import { coerce, validateSchema } from './schema';
import {
  METHOD,
  type ErrorHandler,
  type EvaMiddleware,
  type EvaRouteOptions,
  type Handler,
  type Method,
  type RouteConfig,
  type TrieNode,
} from './types';

function isMethod(method: string): method is Method {
  return method in METHOD;
}

/**
 * Fluent registrar returned by `Eva.route()`. Each verb takes the handler
 * followed by an optional per-route config (middlewares + schema).
 */
export interface RouteBuilder<T extends EvaRouteOptions = {}> {
  get(handler: Handler<T>, config?: RouteConfig): RouteBuilder<T>;
  post(handler: Handler<T>, config?: RouteConfig): RouteBuilder<T>;
  put(handler: Handler<T>, config?: RouteConfig): RouteBuilder<T>;
  patch(handler: Handler<T>, config?: RouteConfig): RouteBuilder<T>;
  delete(handler: Handler<T>, config?: RouteConfig): RouteBuilder<T>;
  options(handler: Handler<T>, config?: RouteConfig): RouteBuilder<T>;
}

export class Eva {
  private _router: Router;
  private _globalMiddleware: EvaMiddleware[] = [];
  private _errorHandler?: ErrorHandler;

  constructor() {
    this._router = new Router();
  }

  /**
   * TODO: Cambiar a otro patron que sea inverso para mejorar la implementación.
   * Esta forma es extraña
   */
  toParent(parent: Eva, prefix: string = ''): void {
    for (const m of Object.values(METHOD)) {
      copyRoutes(m, this._router.getRoutes()[m], '');
    }

    function copyRoutes(method: Method, node: TrieNode, path: string) {
      if (node?.handler) {
        const fullPath = prefix + (path ?? '/');
        parent._router.addRoute(method, fullPath, node.handler, {
          middlewares: node.middlewares,
          schemaOptions: node.schemaOptions,
        });
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
    handler: Handler<T>,
    config?: RouteConfig,
  ): Eva {
    this._router.addRoute(method, route, handler, config);
    return this;
  }

  /** Registers a GET route. `config.schemaOptions.schema` validates the query. */
  get<T extends EvaRouteOptions>(
    route: string,
    handler: Handler<T>,
    config?: RouteConfig,
  ): Eva {
    return this.makeRoute('GET', route, handler, config);
  }

  /** Registers a POST route. `config.schemaOptions.schema` validates the body. */
  post<T extends EvaRouteOptions>(
    route: string,
    handler: Handler<T>,
    config?: RouteConfig,
  ): Eva {
    return this.makeRoute('POST', route, handler, config);
  }

  /** Registers a PUT route. `config.schemaOptions.schema` validates the body. */
  put<T extends EvaRouteOptions>(
    route: string,
    handler: Handler<T>,
    config?: RouteConfig,
  ): Eva {
    return this.makeRoute('PUT', route, handler, config);
  }

  /** Registers a PATCH route. `config.schemaOptions.schema` validates the body. */
  patch<T extends EvaRouteOptions>(
    route: string,
    handler: Handler<T>,
    config?: RouteConfig,
  ): Eva {
    return this.makeRoute('PATCH', route, handler, config);
  }

  /** Registers a DELETE route. `config.schemaOptions.schema` validates the query. */
  delete<T extends EvaRouteOptions>(
    route: string,
    handler: Handler<T>,
    config?: RouteConfig,
  ): Eva {
    return this.makeRoute('DELETE', route, handler, config);
  }

  /** Registers an OPTIONS route. `config.schemaOptions.schema` validates the query. */
  options<T extends EvaRouteOptions>(
    route: string,
    handler: Handler<T>,
    config?: RouteConfig,
  ): Eva {
    return this.makeRoute('OPTIONS', route, handler, config);
  }

  /**
   * Fluent builder to group several methods on one path. Every verb mirrors
   * the top-level API: handler first, optional per-route config last.
   *
   * ```ts
   * app
   *   .route('/tasks')
   *   .get(listTasks)
   *   .post(createTask, {
   *     middlewares: [requireAuth],
   *     schemaOptions: { schema: taskSchema },
   *   });
   * ```
   */
  route<T extends EvaRouteOptions>(route: string): RouteBuilder<T> {
    const makeMethod = (method: Method) => {
      return (handler: Handler<T>, config?: RouteConfig): RouteBuilder<T> => {
        this._router.addRoute(method, route, handler, config);
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
    const method = req.method;
    const path = url.pathname;

    if (!isMethod(method)) {
      return new Response('Not Implemented', { status: 501 });
    }

    const query: Record<string, string> = {};
    for (const [key, value] of url.searchParams) {
      query[key] = value;
    }
    ctx.query = query;

    try {
      let response: Response | undefined;

      // Recorre la chain y al final llama a tail. Si un middleware devuelve
      // Response la guardo: corta si se saltó next(), pisa si corrió la chain antes.
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

      // El routing es la última parada de la chain global: toda request pasa
      // antes por los middlewares globales, así el preflight CORS va aunque no
      // haya ruta. Por eso ctx.params aún está vacío en los globales.
      const dispatch = async (): Promise<void> => {
        const methodToSearch: Method = method === 'HEAD' ? 'GET' : method;
        const match = this._router.match(methodToSearch, path);

        if (!match) {
          const availableMethods: string[] = [];

          for (const m of Object.values(METHOD)) {
            if (m === 'HEAD') continue;
            if (this._router.match(m, path)) {
              availableMethods.push(m);
            }
          }
          if (availableMethods.includes('GET')) {
            availableMethods.push('HEAD');
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

        if (match.schemaOptions) {
          const s = match.schemaOptions;
          const opts = {
            whitelist: s.whitelist,
            forbidden: s.EvaForbiddenError,
          };

          if (s.params) {
            coerce(s.params, ctx.params);
            if (!validateSchema(s.params, ctx.params, opts)) {
              throw new EvaBadRequestError();
            }
          }
          if (s.schema) {
            const usesBody =
              method === 'POST' || method === 'PUT' || method === 'PATCH';
            const data = usesBody ? await ctx.json() : ctx.query;
            if (!usesBody) coerce(s.schema, data);
            if (!validateSchema(s.schema, data, opts)) {
              throw new EvaBadRequestError();
            }
          }
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
