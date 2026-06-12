// Eva has two unrelated error families. Do not mix them:
//
// - EvaConfigError: developer mistakes while BUILDING the app (bad route
//   patterns, duplicate registrations). No HTTP status — they crash at
//   startup, on purpose, and never reach a client.
// - EvaError and subclasses: HTTP errors thrown while HANDLING a request.
//   Eva's error boundary serializes them to a JSON response automatically.

/**
 * Configuration error: thrown while the app is being built (registering
 * routes, mounting instances...), never while serving a request.
 *
 * It signals a developer mistake, so it carries no HTTP status — it is
 * meant to crash loudly at startup, not to be serialized into a response.
 * Application code should not throw this.
 */
export class EvaConfigError extends Error {}

/**
 * Base class for HTTP errors. Throw it — or one of its subclasses — from
 * any handler or middleware and Eva's error boundary will turn it into a
 * JSON response with the matching status code:
 *
 * ```ts
 * app.get('/users/:id', (ctx) => {
 *   throw new EvaNotFoundError(`User ${ctx.params.id} does not exist`);
 *   // -> 404 { "error": "User 123 does not exist" }
 * });
 * ```
 */
export class EvaError extends Error {
  statusCode: number;

  constructor(statusCode = 500, message = 'Internal Server Error') {
    super(message);
    this.statusCode = statusCode;
  }
}

/** 400 — the request is malformed (invalid JSON body, bad URL encoding...). */
export class EvaBadRequestError extends EvaError {
  constructor(message = 'Bad Request') {
    super(400, message);
  }
}

/** 401 — the request lacks valid authentication credentials. */
export class EvaUnauthorizedError extends EvaError {
  constructor(message = 'Unauthorized') {
    super(401, message);
  }
}

/** 403 — authenticated, but not allowed to do this. */
export class EvaForbiddenError extends EvaError {
  constructor(message = 'Forbidden') {
    super(403, message);
  }
}

/** 404 — the requested resource does not exist. */
export class EvaNotFoundError extends EvaError {
  constructor(message = 'Resource not found') {
    super(404, message);
  }
}

/** 409 — the request conflicts with the current state (e.g. duplicate resource). */
export class EvaConflictError extends EvaError {
  constructor(message = 'Resource already exists') {
    super(409, message);
  }
}

/** 500 — something broke on the server and it is not the client's fault. */
export class EvaInternalServerError extends EvaError {
  constructor(message = 'Internal Server Error') {
    super(500, message);
  }
}
