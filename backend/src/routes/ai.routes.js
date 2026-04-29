import { existsSync, mkdirSync, unlinkSync, createWriteStream } from 'fs';
import { readFile } from 'fs/promises';
import { dirname, extname, join } from 'path';
import { pipeline } from 'stream/promises';
import { fileURLToPath } from 'url';

import { authenticate } from '../hooks/authenticate.js';
import { getCaseById } from '../services/case.service.js';
import { sendSuccess } from '../utils/errors.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = join(__dirname, '..', '..', 'uploads');

const PDF_CHUNK_SIZE = 1200;
const MAX_PDF_BYTES = 15 * 1024 * 1024;
const MAX_CHUNKS = 80;
const OLLAMA_TIMEOUT_MS = 60000;
const MERGE_BATCH_SIZE = 8;

if (!existsSync(UPLOAD_DIR)) mkdirSync(UPLOAD_DIR, { recursive: true });

let pdfParse = null;

async function getPdfParser() {
  if (pdfParse) return pdfParse;

  if (typeof global.DOMMatrix === 'undefined') global.DOMMatrix = class DOMMatrix {};
  if (typeof global.Path2D === 'undefined') global.Path2D = class Path2D {};

  const mod = await import('pdf-parse');
  pdfParse = mod.default || mod;
  return pdfParse;
}

async function extractPdfText(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new Error('PDF buffer is empty');
  }

  if (buffer.length > MAX_PDF_BYTES) {
    throw new Error('PDF is too large to summarize safely');
  }

  const parser = await getPdfParser();
  const parsed = await parser(buffer);
  const text = normalizeText(parsed?.text || '');

  if (!text) {
    throw new Error('Could not extract readable text from this PDF');
  }

  return text;
}

function normalizeText(text) {
  return String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function splitIntoChunks(text, chunkSize = PDF_CHUNK_SIZE) {
  const source = normalizeText(text);
  if (!source) return [];

  const chunks = [];
  let index = 0;

  while (index < source.length) {
    const end = Math.min(index + chunkSize, source.length);
    const window = source.slice(index, end);
    let cut = window.lastIndexOf('\n\n');

    if (cut < chunkSize * 0.45) cut = window.lastIndexOf('\n');
    if (cut < chunkSize * 0.45) cut = window.lastIndexOf('. ');
    if (cut < chunkSize * 0.45) cut = window.lastIndexOf(' ');
    if (cut < 1) cut = window.length;

    const chunk = window.slice(0, cut).trim();
    if (chunk) chunks.push(chunk);
    index += cut;
  }

  return chunks;
}

function getOllamaGenerateUrl() {
  let url = (process.env.OLLAMA_URL || process.env.NGROK_URL || 'http://localhost:11434').trim();
  if (url.endsWith('/')) url = url.slice(0, -1);
  if (!url.endsWith('/api/generate')) url += '/api/generate';
  return url;
}

async function callOllamaGenerate(prompt, timeoutMs = OLLAMA_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(getOllamaGenerateUrl(), {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',
      },
      body: JSON.stringify({
        model: process.env.AI_MODEL || 'phi',
        prompt,
        stream: false,
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`Ollama returned ${response.status}: ${body.slice(0, 200)}`);
    }

    const result = await response.json();
    const output = normalizeText(result?.response || '');

    if (!output) {
      throw new Error('Ollama returned an empty response');
    }

    return output;
  } finally {
    clearTimeout(timeout);
  }
}

function buildChunkPrompt(chunk) {
  return `Summarize into key facts and conclusion. Use only given text.\n\n${chunk}`;
}

function buildMergePrompt(summaryText) {
  return `Merge these partial summaries into one final summary. Use only given text.

Output format exactly:
Overview:
Key Facts:
Legal Points:
Conclusion:

${summaryText}`;
}

async function summarizeTextChunks(text) {
  const chunks = splitIntoChunks(text);

  if (chunks.length === 0) {
    throw new Error('No content to summarize');
  }

  if (chunks.length > MAX_CHUNKS) {
    throw new Error('PDF text is too large to summarize safely');
  }

  const summaries = [];

  for (const chunk of chunks) {
    summaries.push(await callOllamaGenerate(buildChunkPrompt(chunk)));
  }

  return {
    chunkCount: chunks.length,
    summary: await mergeSummaries(summaries),
  };
}

async function mergeSummaries(summaries) {
  let pending = summaries.filter(Boolean);

  while (pending.length > MERGE_BATCH_SIZE) {
    const next = [];

    for (let i = 0; i < pending.length; i += MERGE_BATCH_SIZE) {
      const batch = pending.slice(i, i + MERGE_BATCH_SIZE).join('\n\n');
      next.push(await callOllamaGenerate(buildMergePrompt(batch)));
    }

    pending = next;
  }

  return await callOllamaGenerate(buildMergePrompt(pending.join('\n\n')));
}

async function summarizePdfBuffer(buffer) {
  const text = await extractPdfText(buffer);
  return await summarizeTextChunks(text);
}

function pickLatestPdfFilename(documents = []) {
  for (let i = documents.length - 1; i >= 0; i--) {
    const name = documents[i];
    if (typeof name === 'string' && extname(name).toLowerCase() === '.pdf') {
      return name;
    }
  }

  return null;
}

function buildCaseText(caseData) {
  return normalizeText([
    `Title: ${caseData.title || ''}`,
    `Category: ${caseData.category || ''}`,
    `Status: ${caseData.status || ''}`,
    `Description: ${caseData.description || ''}`,
    caseData.lawyerNote ? `Lawyer Notes: ${caseData.lawyerNote}` : '',
    caseData.nextHearing ? `Next Hearing: ${caseData.nextHearing}` : '',
  ].filter(Boolean).join('\n'));
}

async function summarizeCase(caseId, currentUser) {
  const caseData = await getCaseById(caseId, currentUser);
  const pdfName = pickLatestPdfFilename(caseData.documents || []);

  if (pdfName) {
    const pdfPath = join(UPLOAD_DIR, pdfName);

    if (!existsSync(pdfPath)) {
      throw new Error('PDF file not found on server');
    }

    const result = await summarizePdfBuffer(await readFile(pdfPath));
    return { ...result, source: 'pdf', document: pdfName };
  }

  const text = buildCaseText(caseData);
  const result = await summarizeTextChunks(text);
  return { ...result, source: 'text', document: null };
}

export default async function aiRoutes(fastify) {
  fastify.post('/summarize', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      let result;

      if (typeof request.isMultipart === 'function' && request.isMultipart()) {
        const file = await request.file();

        if (!file) {
          throw new Error('No file uploaded');
        }

        const ext = extname(file.filename || '').toLowerCase();
        if (ext !== '.pdf' && file.mimetype !== 'application/pdf') {
          throw new Error('Only PDF files are supported');
        }

        result = await summarizePdfBuffer(await file.toBuffer());
        result.source = 'pdf';
        result.document = file.filename;
      } else {
        const { case_id, text } = request.body || {};

        if (case_id) {
          result = await summarizeCase(case_id, request.currentUser);
        } else if (text && text.trim()) {
          result = { ...(await summarizeTextChunks(text)), source: 'text', document: null };
        } else {
          throw new Error('No content to summarize');
        }
      }

      return sendSuccess(reply, {
        data: {
          summary: result.summary,
          descriptionSummary: result.summary,
          documentSummary: '',
          status: 'success',
          source: result.source,
          document: result.document,
          chunkCount: result.chunkCount,
        },
      });
    } catch (err) {
      return sendSuccess(reply, {
        data: {
          summary: `AI summarization is temporarily unavailable. Error: ${err.message}`,
          descriptionSummary: '',
          documentSummary: '',
          status: 'error',
          source: 'text',
        },
      });
    }
  });

  fastify.post('/summarize-file', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    let tmpPath = null;

    try {
      const file = await request.file();

      if (!file) {
        throw new Error('No file uploaded');
      }

      const ext = extname(file.filename || '').toLowerCase();
      if (ext !== '.pdf' && file.mimetype !== 'application/pdf') {
        throw new Error('Only PDF files are supported');
      }

      const safeName = `ai_tmp_${Date.now()}${ext || '.pdf'}`;
      tmpPath = join(UPLOAD_DIR, safeName);
      await pipeline(file.file, createWriteStream(tmpPath));

      const result = await summarizePdfBuffer(await readFile(tmpPath));

      return sendSuccess(reply, {
        data: {
          summary: result.summary,
          status: 'success',
          source: 'pdf',
          document: file.filename,
          chunkCount: result.chunkCount,
        },
      });
    } catch (err) {
      return sendSuccess(reply, {
        data: {
          summary: `File summarization failed: ${err.message}`,
          status: 'error',
          source: 'pdf',
        },
      });
    } finally {
      if (tmpPath && existsSync(tmpPath)) {
        try {
          unlinkSync(tmpPath);
        } catch {}
      }
    }
  });

  fastify.get('/health', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const url = getOllamaGenerateUrl().replace('/api/generate', '/api/tags');

    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(5000),
        headers: { 'ngrok-skip-browser-warning': 'true' },
      });
      const body = await response.json().catch(() => ({}));
      return sendSuccess(reply, {
        data: {
          ollama: response.ok ? 'reachable' : 'unreachable',
          url,
          models: (body.models || []).map((model) => model.name),
        },
      });
    } catch (err) {
      return sendSuccess(reply, {
        data: {
          ollama: 'unreachable',
          url,
          error: err.message,
        },
      });
    }
  });
}
