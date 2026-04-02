import { loginBodySchema, registerBodySchema, authResponseSchema }
  from "../schemas/auth.schema.js";
import { login, register } from "../controllers/auth.controller.js";

export default async function authRoutes(fastify) {
  fastify.post("/login",
    { schema: { body: loginBodySchema, response: authResponseSchema } },
    login
  );
  fastify.post("/register",
    { schema: { body: registerBodySchema, response: authResponseSchema } },
    register
  );
}