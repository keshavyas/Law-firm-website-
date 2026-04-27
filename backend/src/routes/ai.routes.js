import { authenticate } from '../hooks/authenticate.js';
import { sendError, sendSuccess } from '../utils/errors.js';
import { getCaseById } from '../services/case.service.js';

export default async function aiRoutes(fastify) {
  
  const OLLAMA_URL = process.env.OLLAMA_URL || 'https://evolve-vehicular-atrium.ngrok-free.dev/api/generate';
  const AI_MODEL   = process.env.AI_MODEL || 'phi';

  fastify.post('/summarize', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { case_id, text } = request.body;
    console.log(`[AI] Starting summarization request for case: ${case_id || 'manual text'}`);

    try {
      let textToSummarize = text || '';

      if (case_id) {
        try {
          const caseData = await getCaseById(case_id, request.currentUser);
          textToSummarize = `Title: ${caseData.title}\n` +
                            `Category: ${caseData.category}\n` +
                            `Details: ${caseData.description}\n` +
                            (caseData.lawyerNote ? `Notes: ${caseData.lawyerNote}` : '');
        } catch (fetchErr) {
          console.error(`[AI] Case fetch failed: ${fetchErr.message}`);
        }
      }

      if (!textToSummarize.trim()) {
        throw new Error('No content to summarize');
      }

      // Input size limiter for phi model stability
      if (textToSummarize.length > 2000) {
        textToSummarize = textToSummarize.substring(0, 2000) + '... [truncated]';
      }

      // Simplified prompt for smaller models like "phi"
      const phiPrompt = `Case Details:
${textToSummarize}

Summarize this legal case clearly.
Use exactly these headers:
Overview:
Key Facts:
Legal Context:
Next Steps:

Keep it concise and professional.`;

      // 20-second timeout handling
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);

      try {
        const response = await fetch(OLLAMA_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            model: AI_MODEL,
            prompt: phiPrompt,
            stream: false
          }),
        });

        if (!response.ok) {
          throw new Error(`Ollama returned ${response.status}`);
        }

        const result = await response.json();
        const summary = (result.response || '').trim();

        if (!summary) {
          throw new Error('Empty AI response');
        }

        return sendSuccess(reply, { 
          data: { summary, status: 'success' } 
        });

      } catch (fetchErr) {
        if (fetchErr.name === 'AbortError') {
          throw new Error('Request timed out after 20 seconds');
        }
        throw fetchErr;
      } finally {
        // Critical fix: Ensure timeout is always cleared
        clearTimeout(timeoutId);
      }

    } catch (err) {
      console.error(`[AI] Request failed: ${err.message}`);
      
      // Standard fallback message for production stability
      return sendSuccess(reply, { 
        data: { 
          summary: "AI summarization service is temporarily unavailable.",
          status: "error"
        } 
      });
    }
  });
}
