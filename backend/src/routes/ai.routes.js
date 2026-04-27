import { authenticate }        from '../hooks/authenticate.js';
import { sendError, sendSuccess } from '../utils/errors.js';
import { getCaseById }           from '../services/case.service.js';
import { readFile }              from 'fs/promises';
import { join, dirname, extname } from 'path';
import { fileURLToPath }         from 'url';
import { pipeline }              from 'stream/promises';
import { createWriteStream, existsSync, mkdirSync, unlinkSync } from 'fs';

const __dirname  = dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = join(__dirname, '..', '..', 'uploads');
if (!existsSync(UPLOAD_DIR)) mkdirSync(UPLOAD_DIR, { recursive: true });

// ── Ollama URL resolution ────────────────────────────────────────────────────
// Priority: env var → host.docker.internal (EC2 production) → localhost (dev)
function getOllamaUrl() {
  if (process.env.OLLAMA_URL) return process.env.OLLAMA_URL;
  if (process.env.NODE_ENV === 'production') {
    return 'http://host.docker.internal:11434/api/generate';
  }
  return 'http://localhost:11434/api/generate';
}

// ── Lazy-load heavy extractors so startup is fast ────────────────────────────
let _pdfParse = null;
async function extractPdfText(buffer) {
  if (!_pdfParse) {
    const mod = await import('pdf-parse/lib/pdf-parse.js');
    _pdfParse = mod.default;
  }
  const data = await _pdfParse(buffer);
  return data.text || '';
}

let _tesseract = null;
async function extractImageText(buffer, mimeType) {
  if (!_tesseract) {
    const mod = await import('tesseract.js');
    _tesseract = mod;
  }
  const { createWorker } = _tesseract;
  const worker = await createWorker('eng');
  try {
    const { data: { text } } = await worker.recognize(buffer);
    return text || '';
  } finally {
    await worker.terminate();
  }
}

// ── Core Ollama call ──────────────────────────────────────────────────────────
async function callOllama(textToSummarize, timeoutMs = 30000) {
  const OLLAMA_URL = getOllamaUrl();
  const AI_MODEL   = process.env.AI_MODEL || 'phi';

  // Truncate for phi model stability
  const content = textToSummarize.length > 3000
    ? textToSummarize.substring(0, 3000) + '... [truncated]'
    : textToSummarize;

  const prompt = `You are a legal assistant. Summarize the following case information clearly and professionally.

${content}

Use exactly these section headers:
Overview:
Key Facts:
Legal Context:
Next Steps:

Keep it concise and professional.`;

  const controller = new AbortController();
  const timeoutId  = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(OLLAMA_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      signal:  controller.signal,
      body:    JSON.stringify({ model: AI_MODEL, prompt, stream: false }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`Ollama returned ${response.status}: ${errText.slice(0, 200)}`);
    }

    const result  = await response.json();
    const summary = (result.response || '').trim();
    if (!summary) throw new Error('Ollama returned an empty response');
    return summary;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ── Routes ────────────────────────────────────────────────────────────────────
export default async function aiRoutes(fastify) {

  // ── POST /api/ai/summarize  (JSON — case_id or raw text) ─────────────────
  fastify.post('/summarize', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const { case_id, text } = request.body || {};
    console.log(`[AI] /summarize — case: ${case_id || 'manual text'}`);

    try {
      let textToSummarize = text || '';

      if (case_id) {
        try {
          const caseData = await getCaseById(case_id, request.currentUser);
          textToSummarize =
            `Title: ${caseData.title}\n` +
            `Category: ${caseData.category}\n` +
            `Status: ${caseData.status}\n` +
            `Description: ${caseData.description}\n` +
            (caseData.lawyerNote ? `Lawyer Notes: ${caseData.lawyerNote}\n` : '') +
            (caseData.nextHearing ? `Next Hearing: ${caseData.nextHearing}\n` : '');
        } catch (fetchErr) {
          console.error(`[AI] Case fetch failed: ${fetchErr.message}`);
        }
      }

      if (!textToSummarize.trim()) {
        throw new Error('No content to summarize');
      }

      const summary = await callOllama(textToSummarize);
      return sendSuccess(reply, { data: { summary, status: 'success', source: 'text' } });

    } catch (err) {
      console.error(`[AI] /summarize failed: ${err.message}`);
      return sendSuccess(reply, {
        data: {
          summary: `AI summarization is temporarily unavailable. Error: ${err.message}`,
          status:  'error',
          source:  'text',
        },
      });
    }
  });

  // ── POST /api/ai/summarize-file  (multipart — PDF or image) ──────────────
  fastify.post('/summarize-file', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    console.log('[AI] /summarize-file — incoming multipart request');
    let tmpPath = null;

    try {
      const data = await request.file();
      if (!data) {
        return reply.status(400).send({
          success: false,
          error: { code: 'BAD_REQUEST', message: 'No file uploaded', status: 400 },
        });
      }

      const ext      = extname(data.filename).toLowerCase();
      const mime     = data.mimetype || '';
      const allowed  = ['.pdf', '.jpg', '.jpeg', '.png', '.webp'];

      if (!allowed.includes(ext)) {
        return reply.status(400).send({
          success: false,
          error: {
            code:    'UNSUPPORTED_FILE',
            message: `Unsupported file type "${ext}". Allowed: PDF, JPG, PNG, WEBP`,
            status:  400,
          },
        });
      }

      // Save temp file so we can buffer it
      const safeName = `ai_tmp_${Date.now()}${ext}`;
      tmpPath = join(UPLOAD_DIR, safeName);
      await pipeline(data.file, createWriteStream(tmpPath));

      const buffer = await readFile(tmpPath);
      console.log(`[AI] File received: ${data.filename} (${buffer.length} bytes, ${mime})`);

      // Extract text from file
      let extractedText = '';
      let sourceType    = 'file';

      if (ext === '.pdf' || mime === 'application/pdf') {
        console.log('[AI] Extracting text from PDF...');
        sourceType    = 'pdf';
        extractedText = await extractPdfText(buffer);
        console.log(`[AI] PDF extracted ${extractedText.length} chars`);
      } else {
        console.log('[AI] Running OCR on image...');
        sourceType    = 'image';
        extractedText = await extractImageText(buffer, mime);
        console.log(`[AI] OCR extracted ${extractedText.length} chars`);
      }

      if (!extractedText.trim()) {
        return sendSuccess(reply, {
          data: {
            summary: 'Could not extract readable text from this file. The file may be scanned without OCR, or the image has no recognizable text.',
            status:  'no_content',
            source:  sourceType,
          },
        });
      }

      console.log('[AI] Sending extracted text to Ollama...');
      const summary = await callOllama(extractedText, 40000);

      return sendSuccess(reply, { data: { summary, status: 'success', source: sourceType } });

    } catch (err) {
      console.error(`[AI] /summarize-file failed: ${err.message}`);
      return sendSuccess(reply, {
        data: {
          summary: `File summarization failed: ${err.message}`,
          status:  'error',
          source:  'file',
        },
      });
    } finally {
      // Clean up temp file
      if (tmpPath && existsSync(tmpPath)) {
        try { unlinkSync(tmpPath); } catch (_) { /* ignore */ }
      }
    }
  });

  // ── GET /api/ai/health  (check Ollama connectivity) ──────────────────────
  fastify.get('/health', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const OLLAMA_URL = getOllamaUrl().replace('/api/generate', '/api/tags');
    try {
      const res = await fetch(OLLAMA_URL, { signal: AbortSignal.timeout(5000) });
      const json = await res.json().catch(() => ({}));
      const models = (json.models || []).map(m => m.name);
      return sendSuccess(reply, { data: { ollama: 'reachable', url: OLLAMA_URL, models } });
    } catch (err) {
      return sendSuccess(reply, { data: { ollama: 'unreachable', url: OLLAMA_URL, error: err.message } });
    }
  });
}
