
export class AppError extends Error {
  constructor(message, statusCode = 500, code = "INTERNAL_ERROR") {
    super(message);
    this.statusCode = statusCode;
    this.code       = code;
    this.name       = "AppError";
    Error.captureStackTrace(this, this.constructor);
  }
}

// Factory shortcuts — self-documenting, no chance of wrong status code
export const badRequest   = (msg = "Bad request")              => new AppError(msg, 400, "BAD_REQUEST");
export const unauthorized = (msg = "Unauthorized")             => new AppError(msg, 401, "UNAUTHORIZED");
export const forbidden    = (msg = "Forbidden")                => new AppError(msg, 403, "FORBIDDEN");
export const notFound     = (msg = "Resource not found")       => new AppError(msg, 404, "NOT_FOUND");
export const conflict     = (msg = "Resource already exists")  => new AppError(msg, 409, "CONFLICT");
export const serverError  = (msg = "Internal server error")    => new AppError(msg, 500, "INTERNAL_ERROR");

// Formats any error into the contract shape and sends the HTTP response
export function sendError(reply, error) {
  const isAppError = error instanceof AppError;
  const statusCode = isAppError ? error.statusCode : (error.statusCode || 500);
  const code       = isAppError ? error.code       : (error.code || "INTERNAL_ERROR");
  const message    = error.message || "Something went wrong";

  return reply.status(statusCode).send({
    success: false,
    error: {
      code,
      message,
      status: statusCode,
      // Stack trace only in development — never expose in production
      ...(process.env.NODE_ENV === "development" && { stack: error.stack }),
    },
  });
}

// Formats a successful response
export function sendSuccess(reply, payload = {}, statusCode = 200) {
  return reply.status(statusCode).send({
    success: true,
    ...payload,
  });
}