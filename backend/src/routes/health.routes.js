async function healthRoutes(fastify, options) {

  fastify.get("/health", async (request, reply) => {
    return {
      status: "ok",
      service: "case-manager-api",
      message : "health routes is running properly"
    }
  })

}

export default healthRoutes;