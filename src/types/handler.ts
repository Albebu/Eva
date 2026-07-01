import { EvaForbiddenError } from '../errors';
import type { EvaContext } from '../eva-context';
import type { EvaMiddleware } from './middleware';
import type { SchemaNode } from '../schema';

export interface EvaRouteOptions {
  Query?: Record<string, string>;
  Params?: Record<string, string>;
  Body?: unknown;
}

/**
 * Per-route config, passed as the last argument to every verb method after
 * the handler: `app.post(path, handler, config)`. Route-level middlewares
 * live here now (they used to be variadic args before the handler).
 */
export interface RouteConfig {
  middlewares?: EvaMiddleware[];
  schemaOptions?: {
    schema?: SchemaNode;
    params?: SchemaNode;
    whitelist?: boolean;
    EvaForbiddenError?: boolean;
  };
}

export type Handler<T extends EvaRouteOptions = {}> = (
  ctx: EvaContext<T>,
) => Response | Promise<Response>;

export interface JsonOptions {
  status?: number;
}

export interface TextOptions {
  status?: number;
}

export interface EvaErrorOptions {
  status?: number;
  message?: string;
  callback?: () => void;
}
