async function errorHandler(fastify, options) {

  fastify.setErrorHandler((error, request, reply) => {

    reply.status(error.statusCode || 500).send({
      error: {
        code: error.code || "INTERNAL_SERVER_ERROR",
        message: error.message
      }
    })

  })

}

export default errorHandler;
