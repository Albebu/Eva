export class ResponseBuilder {
  private _headers: Headers = new Headers();

  setHeader(key: string, value: string): void {
    this._headers.set(key, value);
  }

  getHeader(key: string): string | null {
    return this._headers.get(key);
  }

  toJson(data: unknown, options?: { status?: number }): Response {
    const headers = new Headers(this._headers);
    headers.set('Content-Type', 'application/json');
    return new Response(JSON.stringify(data), {
      status: options?.status ?? 200,
      headers,
    });
  }

  toText(data: string, options?: { status?: number }): Response {
    const headers = new Headers(this._headers);
    headers.set('Content-Type', 'text/plain');
    return new Response(data, {
      status: options?.status ?? 200,
      headers,
    });
  }

  redirect(url: string, status: 301 | 302 | 307 | 308 = 301): Response {
    const headers = new Headers(this._headers);
    headers.set('Location', url);
    return new Response(null, { status, headers });
  }

  notFound(): Response {
    return new Response('Not Found 404', {
      status: 404,
      headers: { 'Content-Type': 'text/plain' },
    });
  }
}
