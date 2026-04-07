
import fp from 'fastify-plugin';
import fastifyCors from '@fastify/cors';

/**
 * CORS plugin: allow the configured frontend origin and common dev origins.
 * Uses a function to dynamically allow the incoming Origin header so
 * preflight requests are handled correctly and Access-Control-Allow-Origin
 * mirrors the request origin when allowed.
 */
async function corsPlugin(fastify) {
  const frontend = (process.env.FRONTEND_URL || '').trim();

  // Common development origins to allow during local testing
  const devOrigins = [
    'http://localhost',
    'http://127.0.0.1',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
  ];

  fastify.register(fastifyCors, {
    origin: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
    exposedHeaders: ['Authorization'],
    credentials: true,
  });
}

export default fp(corsPlugin);