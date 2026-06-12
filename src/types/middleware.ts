import type { EvaContext } from '../eva-context';

export type EvaMiddleware = (
  ctx: EvaContext,
  // next never returns the response: it only continues the chain. The
  // response travels through what the middleware itself returns.
  next: () => Promise<void>,
) => void | Promise<Response | void>;

export type ErrorHandler = (
  error: unknown,
  ctx: EvaContext,
) => Response | Promise<Response>;
