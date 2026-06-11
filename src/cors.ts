import { methods } from './shared';
import type { EvaMiddleware } from './types';
import type { CorsOptions } from './types/cors';

const allowedHeaders = ['Content-Type'];

export function cors(options: CorsOptions): EvaMiddleware {
  return async (ctx, next) => {
    if (options.origin === '*') {
      ctx.setHeader('Access-Control-Allow-Origin', '*');
      ctx.setHeader('Access-Control-Allow-Methods', methods.join(', '));
      ctx.setHeader('Access-Control-Allow-Headers', allowedHeaders.join(', '));

      if (ctx.req.method === 'OPTIONS') {
        return;
      }

      return await next();
    }

    const requestOrigin = ctx.getHeader('Origin');

    // Si no tiene origin (viene de un backend) la dejamos pasar sin problemas.
    if (requestOrigin === '' || !requestOrigin) {
      return await next();
    }

    // Si tiene origin (viene del frontend) y coincide la dejamos pasar y ponemos los headers.
    if (
      requestOrigin === options.origin ||
      options.origin.includes(requestOrigin)
    ) {
      ctx.setHeader('Access-Control-Allow-Origin', requestOrigin);
      ctx.setHeader('Access-Control-Allow-Methods', methods.join(', '));
      ctx.setHeader('Access-Control-Allow-Headers', allowedHeaders.join(', '));
      return await next();
    }

    return await next();
  };
}
