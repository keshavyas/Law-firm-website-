
import fp from 'fastify-plugin';
import fastifyCors from '@fastify/cors';

async function corsPlugin(fastify) {
  fastify.register(fastifyCors, {
    origin:         [process.env.FRONTEND_URL || 'http://localhost:5173', 'http://localhost:3000'],
    methods:        ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials:    true,
  });
}

export default fp(corsPlugin);