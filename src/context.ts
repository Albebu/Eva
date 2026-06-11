import type { EvaRouteOptions } from './types';

export class Context<T extends EvaRouteOptions = {}> {
  req: Request;

  private _rawText: string | undefined;
  private _body: unknown = undefined;
  private _bodyParsed = false;

  private _params: Record<string, string> = {};
  private _query: Record<string, string> = {};

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

  async text(): Promise<string> {
    if (this._rawText !== undefined) {
      return this._rawText;
    }
    this._rawText = await this.req.text();
    return this._rawText;
  }

  async json<B = unknown>(): Promise<B> {
    if (this._bodyParsed) {
      return this._body as B;
    }
    const raw = await this.text();
    this._body = JSON.parse(raw);
    this._bodyParsed = true;
    return this._body as B;
  }
}

type QueryType<T extends EvaRouteOptions> =
  T['Query'] extends Record<string, string>
    ? T['Query']
    : Record<string, string>;

type ParamsType<T extends EvaRouteOptions> =
  T['Params'] extends Record<string, string>
    ? T['Params']
    : Record<string, string>;
