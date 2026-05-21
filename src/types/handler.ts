import type { EvaContext } from "../eva-context";

export interface EvaRouteOptions {
  Query?: Record<string, string>;
  Params?: Record<string, string>;
  Body?: unknown;
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
