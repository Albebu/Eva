import { EvaError } from "./errors";
import { EvaContext } from "./eva-context";
import { Router } from "./router";
import type {
  ErrorHandler,
  EvaMiddleware,
  EvaRouteOptions,
  Handler,
  Method,
} from "./types";

export class Eva {
  private _router: Router;
  private _globalMiddleware: EvaMiddleware[] = [];
  private _errorHandler?: ErrorHandler;

  constructor() {
    this._router = new Router();
  }

  // | Middleware | //

  use(middleware: EvaMiddleware): Eva {
    this._globalMiddleware.push(middleware);
    return this;
  }

  onError(handler: ErrorHandler): Eva {
    this._errorHandler = handler;
    return this;
  }

  // | Routes | //

  // coñazo los overloads 
  get<T extends EvaRouteOptions>(route: string, handler: Handler<T>): Eva;
  get<T extends EvaRouteOptions>(route: string, middlewares: EvaMiddleware[], handler: Handler<T>): Eva;
  get<T extends EvaRouteOptions>(route: string, ...args: [Handler<T>] | [EvaMiddleware[], Handler<T>]): Eva {
    if (Array.isArray(args[0])) {
      const [middlewares, handler] = args as [EvaMiddleware[], Handler<T>];
      this._router.addRoute("GET", route, handler, ...middlewares);
    } else {
      const [handler] = args as [Handler<T>];
      this._router.addRoute("GET", route, handler);
    }
    return this;
  }

  post<T extends EvaRouteOptions>(route: string, handler: Handler<T>): Eva;
  post<T extends EvaRouteOptions>(route: string, middlewares: EvaMiddleware[], handler: Handler<T>): Eva;
  post<T extends EvaRouteOptions>(route: string, ...args: [Handler<T>] | [EvaMiddleware[], Handler<T>]): Eva {
    if (Array.isArray(args[0])) {
      const [middlewares, handler] = args as [EvaMiddleware[], Handler<T>];
      this._router.addRoute("POST", route, handler, ...middlewares);
    } else {
      const [handler] = args as [Handler<T>];
      this._router.addRoute("POST", route, handler);
    }
    return this;
  }

  put<T extends EvaRouteOptions>(route: string, handler: Handler<T>): Eva;
  put<T extends EvaRouteOptions>(route: string, middlewares: EvaMiddleware[], handler: Handler<T>): Eva;
  put<T extends EvaRouteOptions>(route: string, ...args: [Handler<T>] | [EvaMiddleware[], Handler<T>]): Eva {
    if (Array.isArray(args[0])) {
      const [middlewares, handler] = args as [EvaMiddleware[], Handler<T>];
      this._router.addRoute("PUT", route, handler, ...middlewares);
    } else {
      const [handler] = args as [Handler<T>];
      this._router.addRoute("PUT", route, handler);
    }
    return this;
  }

  patch<T extends EvaRouteOptions>(route: string, handler: Handler<T>): Eva;
  patch<T extends EvaRouteOptions>(route: string, middlewares: EvaMiddleware[], handler: Handler<T>): Eva;
  patch<T extends EvaRouteOptions>(route: string, ...args: [Handler<T>] | [EvaMiddleware[], Handler<T>]): Eva {
    if (Array.isArray(args[0])) {
      const [middlewares, handler] = args as [EvaMiddleware[], Handler<T>];
      this._router.addRoute("PATCH", route, handler, ...middlewares);
    } else {
      const [handler] = args as [Handler<T>];
      this._router.addRoute("PATCH", route, handler);
    }
    return this;
  }

  delete<T extends EvaRouteOptions>(route: string, handler: Handler<T>): Eva;
  delete<T extends EvaRouteOptions>(route: string, middlewares: EvaMiddleware[], handler: Handler<T>): Eva;
  delete<T extends EvaRouteOptions>(route: string, ...args: [Handler<T>] | [EvaMiddleware[], Handler<T>]): Eva {
    if (Array.isArray(args[0])) {
      const [middlewares, handler] = args as [EvaMiddleware[], Handler<T>];
      this._router.addRoute("DELETE", route, handler, ...middlewares);
    } else {
      const [handler] = args as [Handler<T>];
      this._router.addRoute("DELETE", route, handler);
    }
    return this;
  }

  options<T extends EvaRouteOptions>(route: string, handler: Handler<T>): Eva;
  options<T extends EvaRouteOptions>(route: string, middlewares: EvaMiddleware[], handler: Handler<T>): Eva;
  options<T extends EvaRouteOptions>(route: string, ...args: [Handler<T>] | [EvaMiddleware[], Handler<T>]): Eva {
    if (Array.isArray(args[0])) {
      const [middlewares, handler] = args as [EvaMiddleware[], Handler<T>];
      this._router.addRoute("OPTIONS", route, handler, ...middlewares);
    } else {
      const [handler] = args as [Handler<T>];
      this._router.addRoute("OPTIONS", route, handler);
    }
    return this;
  }

  route<T extends EvaRouteOptions>(route: string) {
    const self = this;
    return {
      get(handler: Handler<T>) {
        self._router.addRoute("GET", route, handler);
        return this;
      },
      getWith(middlewares: EvaMiddleware[], handler: Handler<T>) {
        self._router.addRoute("GET", route, handler, ...middlewares);
        return this;
      },
      post(handler: Handler<T>) {
        self._router.addRoute("POST", route, handler);
        return this;
      },
      postWith(middlewares: EvaMiddleware[], handler: Handler<T>) {
        self._router.addRoute("POST", route, handler, ...middlewares);
        return this;
      },
      put(handler: Handler<T>) {
        self._router.addRoute("PUT", route, handler);
        return this;
      },
      putWith(middlewares: EvaMiddleware[], handler: Handler<T>) {
        self._router.addRoute("PUT", route, handler, ...middlewares);
        return this;
      },
      patch(handler: Handler<T>) {
        self._router.addRoute("PATCH", route, handler);
        return this;
      },
      patchWith(middlewares: EvaMiddleware[], handler: Handler<T>) {
        self._router.addRoute("PATCH", route, handler, ...middlewares);
        return this;
      },
      delete(handler: Handler<T>) {
        self._router.addRoute("DELETE", route, handler);
        return this;
      },
      deleteWith(middlewares: EvaMiddleware[], handler: Handler<T>) {
        self._router.addRoute("DELETE", route, handler, ...middlewares);
        return this;
      },
      options(handler: Handler<T>) {
        self._router.addRoute("OPTIONS", route, handler);
        return this;
      },
      optionsWith(middlewares: EvaMiddleware[], handler: Handler<T>) {
        self._router.addRoute("OPTIONS", route, handler, ...middlewares);
        return this;
      },
    };
  }

  getRoutes() {
    return this._router.getRoutes();
  }

  // | Server |

  serve(port?: number): void {
    Bun.serve({
      port: port ?? 3000,
      fetch: async (req) => {
        const ctx = new EvaContext(req);
        const url = new URL(req.url);
        const method = req.method as Method;
        const path = url.pathname;

        // Parsear query string
        const query: Record<string, string> = {};
        for (const [key, value] of url.searchParams) {
          query[key] = value;
        }
        ctx.query = query;

        try {
          const methodToSearch: Method = method === 'HEAD' ? 'GET' : method
          const match = this._router.match(methodToSearch, path);
          if (!match) {
            // Buscar los métodos soportados para devolver un 405 o 404 en función del resultado.
            // Al tener un radix tree debemos de recorrer todos los métodos para buscar cuales están soportados.
            // Opción lenta, molaría buscar otra nueva, para succes path no afecta así que no es tan crítico.
            const methodsToSearch: Method[] = ["GET", "POST", "PUT", "PATCH", "DELETE"];
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
              return new Response(null, {
                status: 405,
                headers: {
                  "Allow": availableMethods.join(", "),
                },
              });
            }

            return ctx.notFound();
          }

          ctx.params = match.params;
          const handler = match.handler;
          const allMiddleware = [...this._globalMiddleware, ...match.middlewares];

          // Cadena: globalMiddleware → routeMiddleware → handler
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

          // Para cumplir con especificaciones http
          if(method === 'HEAD') {
            return new Response(null, {
              status: response?.status,
              headers: response?.headers
            })
          }

          return response!;
        } catch (error) {
          if (error instanceof EvaError) {
            return new Response(
              JSON.stringify({ error: error.message }),
              { status: error.statusCode, headers: { "Content-Type": "application/json" } },
            );
          }
          if (this._errorHandler) {
            return this._errorHandler(error, ctx);
          }
          console.error(error);
          return new Response(
            JSON.stringify({ error: "Internal Server Error" }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },
    });
  }
}
