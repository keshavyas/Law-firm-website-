import { authenticate, authorizeRole } from '../hooks/authenticate.js';
import {
  createMatterBodySchema,
  updateMatterBodySchema,
  transitionMatterSchema,
  matterQuerySchema,
} from '../schemas/matter.schema.js';
import {
  getMatters,
  getMatter,
  createMatterHandler,
  updateMatterHandler,
  transitionMatterHandler,
  deleteMatterHandler,
} from '../controllers/matter.controller.js';

export default async function matterRoutes(fastify) {

  // GET /api/cases/:caseId/matters — any logged-in user
  fastify.get('/cases/:caseId/matters', {
    preHandler: [authenticate],
    schema:     { querystring: matterQuerySchema },
  }, getMatters);

  // POST /api/cases/:caseId/matters
  // FIX: was [authenticate, authorizeRole('lawyer')]
  // Now: [authenticate] — service checks ownership
  fastify.post('/cases/:caseId/matters', {
    preHandler: [authenticate],
    schema:     { body: createMatterBodySchema },
  }, createMatterHandler);

  // GET /api/matters/:matterId — any logged-in user
  fastify.get('/matters/:matterId', {
    preHandler: [authenticate],
  }, getMatter);

  // PATCH /api/matters/:matterId — lawyer only
  fastify.patch('/matters/:matterId', {
    preHandler: [authenticate, authorizeRole('lawyer')],
    schema:     { body: updateMatterBodySchema },
  }, updateMatterHandler);

  // PATCH /api/matters/:matterId/transition — lawyer only
  fastify.patch('/matters/:matterId/transition', {
    preHandler: [authenticate, authorizeRole('lawyer')],
    schema:     { body: transitionMatterSchema },
  }, transitionMatterHandler);

  // DELETE /api/matters/:matterId — lawyer only
  fastify.delete('/matters/:matterId', {
    preHandler: [authenticate, authorizeRole('lawyer')],
  }, deleteMatterHandler);
}