import type { EvaContext } from '../eva-context';

export type EvaMiddleware = (
  ctx: EvaContext,
  // next no devuelve la response, solo sigue la chain. La response viaja
  // por lo que devuelve el propio middleware.
  next: () => Promise<void>,
) => void | Promise<Response | void>;

export type ErrorHandler = (
  error: unknown,
  ctx: EvaContext,
) => Response | Promise<Response>;
