import type { EvaContext } from '../eva-context';

export type EvaMiddleware = (
  ctx: EvaContext,
  next: () => Promise<Response | void>,
) => void | Promise<Response | void>;

export type ErrorHandler = (
  error: unknown,
  ctx: EvaContext,
) => Response | Promise<Response>;
