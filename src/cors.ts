import { METHOD, type EvaMiddleware } from './types';
import type { CorsOptions } from './types/cors';

const allowedHeaders = ['Content-Type'];

/**
 * Built-in CORS middleware. `origin` accepts `'*'`, one exact origin, or
 * an array of exact origins — matching is always exact, never substring
 * (a request from `https://evil.co` must not pass for `https://evil.com`).
 * Requests without an Origin header (curl, server-to-server) pass through
 * untouched.
 *
 * Pending (see roadmap): preflight for specific origins, `credentials`,
 * `maxAge`, configurable `allowedHeaders`.
 */
export function cors(options: CorsOptions): EvaMiddleware {
  return async (ctx, next) => {
    const requestOrigin = ctx.getHeader('Origin') ?? '';
    let allowedOrigin: string | undefined;

    switch (true) {
      case options.origin === '*':
        allowedOrigin = '*';
        break;

      case requestOrigin === '':
        break;

      case requestOrigin === options.origin:
      case Array.isArray(options.origin) &&
        options.origin.includes(requestOrigin):
        allowedOrigin = requestOrigin;
        break;
    }

    if (allowedOrigin !== undefined) {
      const corsHeaders = {
        'Access-Control-Allow-Origin': allowedOrigin,
        'Access-Control-Allow-Methods': Object.values(METHOD).join(', '),
        'Access-Control-Allow-Headers': allowedHeaders.join(', '),
      };

      // Preflight: the middleware answers it itself (short-circuit) — the
      // handler chain never runs. 204 because a preflight has no body.
      if (ctx.req.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders });
      }

      for (const [key, value] of Object.entries(corsHeaders)) {
        ctx.setHeader(key, value);
      }
    }

    return await next();
  };
}
