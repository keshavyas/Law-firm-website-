import { authenticate } from '../hooks/authenticate.js';
import { sendError, sendSuccess } from '../utils/errors.js';

export default async function aiRoutes(fastify) {
  
  const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://ai-service:3002';

  // POST /api/ai/summarize
  fastify.post('/summarize', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const { case_id, text } = request.body;

      // Simple proxy to AI service
      const response = await fetch(`${AI_SERVICE_URL}/summarize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ case_id, text }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'AI Service Error');
      }

      const data = await response.json();
      return sendSuccess(reply, { data });

    } catch (err) {
      return sendError(reply, err);
    }
  });
}
