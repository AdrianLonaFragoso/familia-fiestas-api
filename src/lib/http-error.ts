export class HttpError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (message: string, details?: unknown) =>
  new HttpError(400, "bad_request", message, details);

export const unauthorized = (message = "No autorizado.") =>
  new HttpError(401, "unauthorized", message);

export const forbidden = (message = "No tienes permiso para realizar esta acción.") =>
  new HttpError(403, "forbidden", message);

export const notFound = (message = "Recurso no encontrado.") =>
  new HttpError(404, "not_found", message);

export const conflict = (message: string, details?: unknown) =>
  new HttpError(409, "conflict", message, details);

export const unprocessable = (message: string, details?: unknown) =>
  new HttpError(422, "unprocessable_entity", message, details);
