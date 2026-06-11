import type { EvaContext } from '../eva-context';

export type EvaMiddleware = (
  ctx: EvaContext,
  next: () => Promise<void>,
) => void | Promise<void>;

export type ErrorHandler = (
  error: unknown,
  ctx: EvaContext,
) => Response | Promise<Response>;
