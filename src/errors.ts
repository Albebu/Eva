
/**
 * Archivo de errores genéricos de la aplicación. Inspirado en NestJS
 */
export class EvaError extends Error {
  statusCode: number;

  constructor(statusCode: number = 500, message: string = "Internal Server Error") {
    super(message);
    this.statusCode = statusCode;
  }
}

export class EvaNotFoundError extends EvaError {
  constructor(message = "Resource not found") {
    super(404, message);
  }
}

export class EvaConflictError extends EvaError {
  constructor(message = "Resource already exists") {
    super(409, message);
  }
}

export class EvaInternalServerError extends EvaError {
  constructor(message = "Internal Server Error") {
    super(500, message);
  }
}

export class EvaUnauthorizedError extends EvaError {
  constructor(message = "Unauthorized") {
    super(401, message);
  }
}

export class EvaForbiddenError extends EvaError {
  constructor(message = "Forbidden") {
    super(403, message);
  }
}
