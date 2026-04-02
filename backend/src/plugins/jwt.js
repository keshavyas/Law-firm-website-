import fp from 'fastify-plugin';
import fastifyJwt from '@fastify/jwt';

async function jwtPlugin(fastify) {
  fastify.register(fastifyJwt, {
    secret: process.env.JWT_SECRET || 'fallback_secret_CHANGE_IN_PRODUCTION',
    sign:   { expiresIn: process.env.JWT_EXPIRES_IN || '7d' },
  });
}

export default fp(jwtPlugin);