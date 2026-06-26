import type { EvaMiddleware } from './types';

/**
 * Built-in body-size-limit middleware. Rejects any request whose
 * `Content-Length` exceeds `maxSize` (bytes) with a 413, short-circuiting
 * the chain before the handler runs.
 *
 */
export function bodyLimit(maxSize: number): EvaMiddleware {
  return async (ctx, next) => {
    const size = ctx.req.body;

    if (!size) {
      return await next();
    }

    let total = 0;

    for await (let chunk of size) {
      total += chunk.length;
      if (total > maxSize) {
        return new Response('Payload Too Large', {
          status: 413,
          statusText: 'Payload Too Large',
        });
      }
    }

    return await next();
  };
}
