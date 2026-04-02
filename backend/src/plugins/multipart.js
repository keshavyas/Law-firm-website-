import fp from 'fastify-plugin';
import fastifyMultipart from '@fastify/multipart';

async function multipartPlugin(fastify) {
  fastify.register(fastifyMultipart, {
    limits: {
      fileSize: 10 * 1024 * 1024, // 10 MB per file
      files:    1,                 // 1 file per request
    },
  });
}

export default fp(multipartPlugin);