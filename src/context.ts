import type { EvaRouteOptions } from "./types";

export class Context<T extends EvaRouteOptions = {}> {
  req: Request;
  private _params: Record<string, string> = {};
  private _query: Record<string, string> = {};
  private _rawBody: string | undefined;

  constructor(req: Request) {
    this.req = req;
  }


  get params(): ParamsType<T> {
    return this._params as ParamsType<T>;
  }

  set params(value: Record<string, string>) {
    this._params = value;
  }


  get query(): QueryType<T> {
    return this._query as QueryType<T>;
  }

  set query(value: Record<string, string>) {
    this._query = value;
  }


  get path(): string {
    return new URL(this.req.url).pathname;
  }

  getHeader(header: string): string | null {
    return this.req.headers.get(header);
  }


  private async getRawBody(): Promise<string> {
    if (this._rawBody === undefined) {
      this._rawBody = await this.req.text();
    }
    return this._rawBody;
  }

  async json<B>(): Promise<B> {
    const raw = await this.getRawBody();
    return JSON.parse(raw);
  }

  async text(): Promise<string> {
    return await this.getRawBody();
  }
}

// ─── Tipos auxiliares de tipado genérico ───

type QueryType<T extends EvaRouteOptions> =
  T["Query"] extends Record<string, string>
    ? T["Query"]
    : Record<string, string>;

type ParamsType<T extends EvaRouteOptions> =
  T["Params"] extends Record<string, string>
    ? T["Params"]
    : Record<string, string>;
