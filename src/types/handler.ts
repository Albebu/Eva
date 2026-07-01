import { EvaForbiddenError } from '../errors';
import type { EvaContext } from '../eva-context';
import type { EvaMiddleware } from './middleware';

export interface EvaRouteOptions {
  Query?: Record<string, string>;
  Params?: Record<string, string>;
  Body?: unknown;
}

/**
 * Placeholder for the not-yet-built schema validator. A route stores it
 * (POST/PUT/PATCH validate the body against it; other verbs validate the
 * query string) but it is NOT enforced at runtime yet — wiring validation
 * into `Eva.handle()` is the next step. Replace `unknown` with the real
 * schema type once the validator exists.
 */
export type EvaSchema = unknown;

/**
 * Per-route config, passed as the last argument to every verb method after
 * the handler: `app.post(path, handler, config)`. Route-level middlewares
 * live here now (they used to be variadic args before the handler).
 */
export interface RouteConfig {
  middlewares?: EvaMiddleware[];
  schemaOptions?: {
    schema?: EvaSchema;
    params?: EvaSchema;
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
