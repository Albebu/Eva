import { methods } from './shared';
import type { EvaMiddleware } from './types';
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
      ctx.setHeader('Access-Control-Allow-Origin', allowedOrigin);
      ctx.setHeader('Access-Control-Allow-Methods', methods.join(', '));
      ctx.setHeader('Access-Control-Allow-Headers', allowedHeaders.join(', '));

      if (allowedOrigin === '*' && ctx.req.method === 'OPTIONS') {
        return;
      }
    }

    return await next();
  };
}
