import Fastify         from "fastify";
import corsPlugin      from "./plugins/cors.js";
import jwtPlugin       from "./plugins/jwt.js";
import multipartPlugin from "./plugins/multipart.js";
import registerRoutes  from "./routes/index.routes.js"; 
import { sendError }   from "./utils/errors.js";

export async function buildApp() {
  // Determine logger transport safely: try to use pino-pretty when available
  let transportOption;
  if (process.env.NODE_ENV !== 'production') {
    try {
      // dynamic import will fail if pino-pretty is not installed in the image
      await import('pino-pretty');
      transportOption = { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss' } };
    } catch (err) {
      // pino-pretty not available; fall back to default transport
      transportOption = undefined;
      console.warn('pino-pretty not found; using default pino transport');
    }
  }

  let fastify;
  try {
    fastify = Fastify({
      logger: {
        level: 'info',
        transport: transportOption,
      },
    });
  } catch (err) {
    // If logger initialization fails (pino transport issues), fall back to a safe logger
    // so the server can still start and we can diagnose DB issues.
    // This prevents the process from exiting due to logger transport resolution errors.
    // Log the error to stdout so the container logs capture the reason.
    // eslint-disable-next-line no-console
    console.warn('Logger initialization failed, falling back to default logger:', err && err.message ? err.message : err);
    fastify = Fastify({ logger: process.env.NODE_ENV === 'production' ? false : { level: 'info' } });
  }

  // Plugins : routes ke phle aayega always , taki routes can use it. 
  await fastify.register(corsPlugin);
  await fastify.register(jwtPlugin);
  await fastify.register(multipartPlugin);

  //Routes
  await fastify.register(registerRoutes); 

  //Root endpoint
  fastify.get("/", async (request, reply) => {
    return reply.send({
      success: true,
      data: {
        name:      "LegalCase API",
        version:   "1.0.0",
        health:    "/health",
        endpoints: {
          login:    "POST /api/auth/login",
          register: "POST /api/auth/register",
          me:       "GET  /api/users/me",
          cases:    "GET  /api/cases",
          stats:    "GET  /api/cases/stats",
        },
      },
    });
  });

  //Global Error Handlers
  fastify.setErrorHandler(function (error, request, reply) {
    fastify.log.error({ err: error, url: request.url, method: request.method });

    if (error.validation) {
      return reply.status(400).send({
        success: false,
        error: {
          code:    "VALIDATION_ERROR",
          message: "Request validation failed",
          status:  400,
          details: error.validation,
        },
      });
    }

    sendError(reply, error);
  });

  fastify.setNotFoundHandler(function (request, reply) {
    reply.status(404).send({
      success: false,
      error: {
        code:    "NOT_FOUND",
        message: `Cannot ${request.method} ${request.url}`,
        status:  404,
      },
    });
  });

  return fastify;
}