import type { EvaMiddleware } from './types';

/**
 * Built-in body-size-limit middleware. Rejects any request whose
 * `Content-Length` exceeds `maxSize` (bytes) with a 413, short-circuiting
 * the chain before the handler runs.
 *
 */
export function bodyLimit(maxSize: number): EvaMiddleware {
  return async (ctx, next) => {
    // ponytail: trusts Content-Length. A lying or chunked client (no
    // Content-Length) bypasses this. Reading the stream to count bytes is
    // NOT an option here: it consumes req.body, so the handler's later
    // ctx.json()/text() throws "body already used". Add a tee-and-count
    // guard only if untrusted clients without Content-Length matter.
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
