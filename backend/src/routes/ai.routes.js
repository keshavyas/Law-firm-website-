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
// In production: OLLAMA_URL secret = ngrok tunnel to local machine
// In development: falls back to localhost:11434
function getOllamaUrl() {
  let url = process.env.OLLAMA_URL || 'http://localhost:11434/api/generate';
  if (url.endsWith('/')) url = url.slice(0, -1);
  if (!url.endsWith('/api/generate')) url += '/api/generate';
  return url;
}

// ── Lazy-load heavy extractors so startup is fast ────────────────────────────
let _pdfParse = null;
async function extractPdfText(buffer) {
  if (!_pdfParse) {
    if (typeof global.DOMMatrix === 'undefined') {
      global.DOMMatrix = class DOMMatrix {};
    }
    if (typeof global.Path2D === 'undefined') {
      global.Path2D = class Path2D {};
    }
    const mod = await import('pdf-parse');
    _pdfParse = mod.default || mod;
  }
  const data = await _pdfParse(buffer);
  return data.text || '';
}

// ── Image text extraction via Ollama vision model (llava / moondream) ─────────
// Runs entirely on the local machine — no heavy OCR library on the server.
async function extractImageTextViaOllama(buffer) {
  const base64      = buffer.toString('base64');
  const ollamaBase  = getOllamaUrl().replace('/api/generate', '');
  const visionModel = process.env.AI_VISION_MODEL || 'llava';

  const controller = new AbortController();
  const timeoutId  = setTimeout(() => controller.abort(), 60000);

  try {
    const response = await fetch(`${ollamaBase}/api/generate`, {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',
        'User-Agent': 'node-fetch'
      },
      signal:  controller.signal,
      body:    JSON.stringify({
        model:  visionModel,
        prompt: 'Extract and return ALL text visible in this image. Return only the raw text, preserving structure. No commentary.',
        images: [base64],
        stream: false,
      }),
    });

    if (!response.ok) {
      const err = await response.text().catch(() => '');
      throw new Error(`Vision model (${visionModel}) error ${response.status}: ${err.slice(0, 200)}`);
    }

    const result = await response.json();
    return (result.response || '').trim();
  } finally {
    clearTimeout(timeoutId);
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
If an "Attached Document" section is provided in the text, you MUST include a summary of it under the header "Attached Document Summary:".

${content}

Use exactly these section headers:
Overview:
Key Facts:
Legal Context:
Next Steps:
Attached Document Summary: (Include this ONLY if an attached document is present in the text above)

Keep it concise and professional.`;

  const controller = new AbortController();
  const timeoutId  = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(OLLAMA_URL, {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',
        'User-Agent': 'node-fetch'
      },
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

async function summarizeCaseSections(caseData) {
  const caseText =
    `Title: ${caseData.title}\n` +
    `Category: ${caseData.category}\n` +
    `Status: ${caseData.status}\n` +
    `Description: ${caseData.description}\n` +
    (caseData.lawyerNote ? `Lawyer Notes: ${caseData.lawyerNote}\n` : '') +
    (caseData.nextHearing ? `Next Hearing: ${caseData.nextHearing}\n` : '');

  let documentText = '';
  let documentName = null;

  // Pick the most recently uploaded *supported* document.
  // Important: users may upload DOC/DOCX after a PDF, and we still want to summarize the PDF.
  // Preference order: latest PDF → latest image → none.
  if (Array.isArray(caseData.documents) && caseData.documents.length > 0) {
    const docs = caseData.documents;

    const supportedPdfIdx = (() => {
      for (let i = docs.length - 1; i >= 0; i--) {
        const name = docs[i];
        if (typeof name !== 'string') continue;
        if (extname(name).toLowerCase() === '.pdf') return i;
      }
      return -1;
    })();

    const supportedImgIdx = (() => {
      for (let i = docs.length - 1; i >= 0; i--) {
        const name = docs[i];
        if (typeof name !== 'string') continue;
        const ext = extname(name).toLowerCase();
        if (['.jpg', '.png', '.jpeg', '.webp'].includes(ext)) return i;
      }
      return -1;
    })();

    const pickedIdx = supportedPdfIdx >= 0 ? supportedPdfIdx : supportedImgIdx;
    if (pickedIdx >= 0) {
      documentName = docs[pickedIdx];
      const docPath = join(UPLOAD_DIR, documentName);

      if (existsSync(docPath)) {
        const buffer = await readFile(docPath);
        const ext = extname(docPath).toLowerCase();

        try {
          if (ext === '.pdf') documentText = await extractPdfText(buffer);
          else if (['.jpg', '.png', '.jpeg', '.webp'].includes(ext)) {
            documentText = await extractImageTextViaOllama(buffer);
          }
        } catch (e) {
          console.error('[AI] Document parsing failed:', e.message);
        }
      }
    }
  }

  const descriptionSummary = await callOllama(caseText);
  let documentSummary = '';
  let source = 'text';

  if (documentText.trim()) {
    documentSummary = await callOllama(documentText, 40000);
    const ext = documentName ? extname(documentName).toLowerCase() : '';
    source = ext === '.pdf' ? 'pdf' : (ext ? 'file' : 'text');
  }

  return { descriptionSummary, documentSummary, source };
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
      let descriptionSummary = '';
      let documentSummary = '';
      let source = 'text';

      if (case_id) {
        try {
          const caseData = await getCaseById(case_id, request.currentUser);
          const sectionSummaries = await summarizeCaseSections(caseData);
          descriptionSummary = sectionSummaries.descriptionSummary;
          documentSummary = sectionSummaries.documentSummary;
          source = sectionSummaries.source;
        } catch (fetchErr) {
          console.error(`[AI] Case fetch failed: ${fetchErr.message}`);
        }
      }

      if (case_id && !descriptionSummary.trim()) {
        throw new Error('No content to summarize');
      }

      if (!case_id && !textToSummarize.trim()) {
        throw new Error('No content to summarize');
      }

      if (!case_id) {
        descriptionSummary = await callOllama(textToSummarize);
      }

      return sendSuccess(reply, {
        data: {
          summary: descriptionSummary,
          descriptionSummary,
          documentSummary,
          status: 'success',
          source,
        },
      });

    } catch (err) {
      console.error(`[AI] /summarize failed: ${err.message}`);
      return sendSuccess(reply, {
        data: {
          summary: `AI summarization is temporarily unavailable. Error: ${err.message}`,
          descriptionSummary: '',
          documentSummary: '',
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
        console.log('[AI] Running Ollama vision OCR on image...');
        sourceType    = 'image';
        extractedText = await extractImageTextViaOllama(buffer);
        console.log(`[AI] Vision OCR extracted ${extractedText.length} chars`);
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
      const res = await fetch(OLLAMA_URL, {
        headers: { 'ngrok-skip-browser-warning': 'true', 'User-Agent': 'node-fetch' },
        signal: AbortSignal.timeout(5000)
      });
      const json = await res.json().catch(() => ({}));
      const models = (json.models || []).map(m => m.name);
      return sendSuccess(reply, { data: { ollama: 'reachable', url: OLLAMA_URL, models } });
    } catch (err) {
      return sendSuccess(reply, { data: { ollama: 'unreachable', url: OLLAMA_URL, error: err.message } });
    }
  });
}
