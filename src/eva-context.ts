import { Context } from './context';
import { ResponseBuilder } from './response';
import type { EvaRouteOptions } from './types';

/**
 * What every handler and middleware receives. Facade over two halves:
 * the request side (Context: params, query, body) and the response side
 * (ResponseBuilder: headers + response helpers).
 *
 * Naming convention: bare verbs READ from the request (`json()`, `text()`),
 * `to*` verbs BUILD a response (`toJson()`, `toText()`).
 */
export class EvaContext<T extends EvaRouteOptions = {}> {
  private _ctx: Context<T>;
  private _res: ResponseBuilder;

  constructor(req: Request) {
    this._ctx = new Context<T>(req);
    this._res = new ResponseBuilder();
  }

  /** The original incoming Request, untouched. */
  get req(): Request {
    return this._ctx.req;
  }

  /**
   * Route params extracted by the router, percent-decoded
   * (`/users/:id` + `/users/a%20b` -> `{ id: 'a b' }`). Wildcard routes
   * expose the consumed rest under the `'*'` key. Absent optional params
   * have no key at all.
   */
  get params(): Context<T>['params'] {
    return this._ctx.params;
  }

  set params(value: Record<string, string>) {
    this._ctx.params = value;
  }

  /** Query string as a plain object. Values are always strings. */
  get query(): Context<T>['query'] {
    return this._ctx.query;
  }

  set query(value: Record<string, string>) {
    this._ctx.query = value;
  }

  /** Pathname of the request URL (no query string). */
  get path(): string {
    return this._ctx.path;
  }

  /** Reads a request header, or null if missing. */
  getHeader(header: string): string | null {
    return this._ctx.getHeader(header);
  }

  /** Parses the request body as JSON. Cached: safe to call repeatedly. */
  async json<B = unknown>(): Promise<B> {
    return this._ctx.json<B>();
  }

  /** Reads the raw request body as text. Cached, like `json()`. */
  async text(): Promise<string> {
    return this._ctx.text();
  }

  /** Sets a response header; applied to whichever response is built later. */
  setHeader(key: string, value: string): void {
    this._res.setHeader(key, value);
  }

  /** Builds a JSON response (default status 200). */
  toJson(data: unknown, options?: { status?: number }): Response {
    return this._res.toJson(data, options);
  }

  /** Builds a plain-text response (default status 200). */
  toText(data: string, options?: { status?: number }): Response {
    return this._res.toText(data, options);
  }

  /** Builds a redirect response (default 301). */
  redirect(url: string, status?: 301 | 302 | 307 | 308): Response {
    return this._res.redirect(url, status);
  }

  /** Builds the standard 404 response. */
  notFound(): Response {
    return this._res.notFound();
  }
}
