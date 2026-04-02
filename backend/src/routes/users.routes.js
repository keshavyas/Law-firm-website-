import { authenticate }          from "../hooks/authenticate.js";
import { getMe, getLawyers }     from "../controllers/users.controller.js";

export default async function usersRoutes(fastify) {
  fastify.get("/me",      { preHandler: [authenticate] }, getMe);
  fastify.get("/lawyers", { preHandler: [authenticate] }, getLawyers);
}
