import type { EvaMiddleware } from './types';

/**
 * Built-in body-size-limit middleware. Rejects any request whose
 * `Content-Length` exceeds `maxSize` (bytes) with a 413, short-circuiting
 * the chain before the handler runs.
 *
 */
export function bodyLimit(maxSize: number): EvaMiddleware {
  return async (ctx, next) => {
    // ponytail: me fío del Content-Length. Un cliente que mienta o vaya
    // chunked se lo salta. No leo el stream para contar bytes porque consume
    // req.body y luego ctx.json()/text() peta con "body already used".
    const len = ctx.req.headers.get('content-length');

    if (len !== null && Number(len) > maxSize) {
      return new Response('Payload Too Large', {
        status: 413,
        statusText: 'Payload Too Large',
      });
    }

    return await next();
  };
}
