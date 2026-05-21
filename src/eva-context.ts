import { Context } from "./context";
import { ResponseBuilder } from "./response";
import type { EvaRouteOptions } from "./types";

/**
 * Contexto que ve el usuario en sus handlers.
 *
 * Combina:
 * - Lectura de request (params, query, headers, body) → de Context
 * - Construcción de response (toJson, toText, redirect, setHeader) → de ResponseBuilder
 *
 * El usuario solo toca esta clase. No necesita saber que internamente
 * están separadas.
 */
export class EvaContext<T extends EvaRouteOptions = {}> {
  private _ctx: Context<T>;
  private _res: ResponseBuilder;

  constructor(req: Request) {
    this._ctx = new Context<T>(req);
    this._res = new ResponseBuilder();
  }

  // ─── Request: delegado a Context ───

  get req(): Request {
    return this._ctx.req;
  }

  get params(): Context<T>["params"] {
    return this._ctx.params;
  }

  set params(value: Record<string, string>) {
    this._ctx.params = value;
  }

  get query(): Context<T>["query"] {
    return this._ctx.query;
  }

  set query(value: Record<string, string>) {
    this._ctx.query = value;
  }

  get path(): string {
    return this._ctx.path;
  }

  getHeader(header: string): string | null {
    return this._ctx.getHeader(header);
  }

  async json<B = unknown>(): Promise<B> {
    return this._ctx.json<B>();
  }

  async text(): Promise<string> {
    return this._ctx.text();
  }

  // ─── Response: delegado a ResponseBuilder ───

  setHeader(key: string, value: string): void {
    this._res.setHeader(key, value);
  }

  toJson(data: unknown, options?: { status?: number }): Response {
    return this._res.toJson(data, options);
  }

  toText(data: string, options?: { status?: number }): Response {
    return this._res.toText(data, options);
  }

  redirect(url: string, status?: 301 | 302 | 307 | 308): Response {
    return this._res.redirect(url, status);
  }

  notFound(): Response {
    return this._res.notFound();
  }
}
