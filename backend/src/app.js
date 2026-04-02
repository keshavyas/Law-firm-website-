import Fastify         from "fastify";
import corsPlugin      from "./plugins/cors.js";
import jwtPlugin       from "./plugins/jwt.js";
import multipartPlugin from "./plugins/multipart.js";
import registerRoutes  from "./routes/index.routes.js"; 
import { sendError }   from "./utils/errors.js";

export async function buildApp() {

  const fastify = Fastify({
    logger: {
      level: process.env.NODE_ENV === "production" ? "warn" : "info",
      transport: process.env.NODE_ENV !== "production"
        ? { target: "pino-pretty", options: { colorize: true, translateTime: "HH:MM:ss" } }
        : undefined,
    },
  });

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
        name:      "DemoCase API",
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