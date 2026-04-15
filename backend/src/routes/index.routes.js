import healthRoutes from "./health.routes.js";
import authRoutes   from "./auth.routes.js";
import usersRoutes  from "./users.routes.js";
import casesRoutes  from "./cases.routes.js";
import matterRoutes from "./matter.routes.js";
import aiRoutes     from "./ai.routes.js";

export default async function RegisterRoutes(fastify){

    fastify.register(healthRoutes);
    fastify.register(authRoutes,   { prefix: "/api/auth" });
    fastify.register(usersRoutes,  { prefix: "/api/users" });
    fastify.register(casesRoutes,  { prefix: "/api/cases" });
    fastify.register(aiRoutes,     { prefix: "/api/ai" });
    fastify.register(matterRoutes , {prefix : "/api" });

}