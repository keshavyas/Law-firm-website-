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

const PDF_CHUNK_SIZE = Number.parseInt(process.env.AI_PDF_CHUNK_SIZE || '3000', 10);
const MAX_PDF_BYTES = 15 * 1024 * 1024;
const MAX_CHUNKS = Number.parseInt(process.env.AI_MAX_CHUNKS || '14', 10);
const OLLAMA_TIMEOUT_MS = Number.parseInt(process.env.AI_SUMMARY_TIMEOUT_MS || '300000', 10);
const OLLAMA_CALL_TIMEOUT_MS = Number.parseInt(process.env.OLLAMA_CALL_TIMEOUT_MS || '90000', 10);
const OLLAMA_NUM_PREDICT = Number.parseInt(process.env.OLLAMA_NUM_PREDICT || '320', 10);
const MERGE_BATCH_SIZE = 6;
const MIN_EXTRACTED_TEXT_CHARS = Number.parseInt(process.env.AI_MIN_EXTRACTED_TEXT_CHARS || '40', 10);
const AI_SUMMARY_TIMEOUT_MESSAGE =
  `AI summary timed out after ${Math.round(OLLAMA_TIMEOUT_MS / 1000)} seconds. Please try again with a shorter case description or a smaller PDF.`;
const UNGROUNDED_SUMMARY_MESSAGE =
  'AI returned a summary that does not match the extracted PDF text. Please try again or upload a clearer text-based PDF.';
const HALLUCINATION_PATTERNS = [
  /curious user/i,
  /artificial intelligence assistant/i,
  /chat between/i,
  /john and jane/i,
  /property rights to a piece of land/i,
  /original purchase agreement was signed by both parties/i,
];
const SUMMARY_STOPWORDS = new Set([
  'about', 'above', 'after', 'against', 'also', 'and', 'another', 'are', 'because', 'been',
  'between', 'both', 'case', 'conclusion', 'document', 'facts', 'from', 'further', 'have',
  'important', 'include', 'includes', 'into', 'issues', 'legal', 'may', 'mentioned', 'necessary',
  'overview', 'points', 'summary', 'text', 'that', 'their', 'there', 'these', 'this', 'with',
  'within', 'without',
]);

if (!existsSync(UPLOAD_DIR)) mkdirSync(UPLOAD_DIR, { recursive: true });

let PDFParseCtor = null;

async function getPdfParser() {
  if (PDFParseCtor) return PDFParseCtor;

  if (typeof global.DOMMatrix === 'undefined') global.DOMMatrix = class DOMMatrix {};
  if (typeof global.Path2D === 'undefined') global.Path2D = class Path2D {};

  const mod = await import('pdf-parse');
  PDFParseCtor = mod.PDFParse;

  if (!PDFParseCtor) {
    throw new Error('PDF parser is unavailable');
  }

  return PDFParseCtor;
}

async function extractPdfText(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new Error('PDF buffer is empty');
  }

  if (buffer.length > MAX_PDF_BYTES) {
    throw new Error('PDF is too large to summarize safely');
  }

  const PDFParse = await getPdfParser();
  const parser = new PDFParse({ data: buffer });
  let parsed;

  try {
    parsed = await parser.getText();
  } finally {
    await parser.destroy();
  }

  const text = normalizeText(parsed?.text || '');

  if (!text || text.length < MIN_EXTRACTED_TEXT_CHARS) {
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

function createTimeoutError() {
  const error = new Error(AI_SUMMARY_TIMEOUT_MESSAGE);
  error.code = 'AI_SUMMARY_TIMEOUT';
  return error;
}

function createSummaryDeadline(timeoutMs = OLLAMA_TIMEOUT_MS) {
  const expiresAt = Date.now() + timeoutMs;

  return {
    remainingMs() {
      return Math.max(0, expiresAt - Date.now());
    },
    throwIfExpired() {
      if (this.remainingMs() <= 0) {
        throw createTimeoutError();
      }
    },
  };
}

async function callOllamaGenerate(prompt, deadline = createSummaryDeadline()) {
  deadline.throwIfExpired();
  const timeoutMs = Math.min(deadline.remainingMs(), OLLAMA_CALL_TIMEOUT_MS);
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
        options: {
          num_predict: OLLAMA_NUM_PREDICT,
          temperature: 0.2,
          top_p: 0.9,
        },
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
  } catch (err) {
    if (err?.name === 'AbortError' || err?.code === 'ABORT_ERR') {
      throw createTimeoutError();
    }

    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

function buildChunkPrompt(chunk) {
  return `You are summarizing an uploaded document for a lawyer.
Use only the text between <document_text> tags. Do not use prior knowledge, examples, or assumptions.
If the text is not enough to summarize, return exactly: UNABLE_TO_SUMMARIZE_PDF
Do not mention people, property, dates, chats, users, or disputes unless they appear in the text.

Return:
- Key facts
- Legal issues
- Important dates/names
- Conclusion

<document_text>
${chunk}
</document_text>`;
}

function buildMergePrompt(summaryText) {
  return `Merge these partial document summaries into one final case summary.
Use only the text between <partial_summaries> tags. Do not add facts, names, dates, disputes, or legal claims that are not present.
If the partial summaries are not enough to summarize, return exactly: UNABLE_TO_SUMMARIZE_PDF

Output format exactly:
Overview:
Key Facts:
Legal Points:
Conclusion:

<partial_summaries>
${summaryText}
</partial_summaries>`;
}

function getSignificantWords(text) {
  const matches = normalizeText(text).toLowerCase().match(/[a-z0-9][a-z0-9'/-]{3,}/g) || [];
  return [...new Set(matches.filter((word) => !SUMMARY_STOPWORDS.has(word)))];
}

function validateGeneratedSummary(summary, sourceText) {
  const normalizedSummary = normalizeText(summary);

  if (!normalizedSummary || normalizedSummary === 'UNABLE_TO_SUMMARIZE_PDF') {
    throw new Error('AI could not summarize the extracted PDF text');
  }

  if (HALLUCINATION_PATTERNS.some((pattern) => pattern.test(normalizedSummary))) {
    throw new Error(UNGROUNDED_SUMMARY_MESSAGE);
  }

  const sourceWords = new Set(getSignificantWords(sourceText));
  const summaryWords = getSignificantWords(normalizedSummary);

  if (summaryWords.length < 4) {
    throw new Error('AI returned an incomplete summary');
  }

  const groundedWords = summaryWords.filter((word) => sourceWords.has(word));
  const groundedRatio = groundedWords.length / summaryWords.length;

  if (groundedWords.length < 3 || groundedRatio < 0.2) {
    throw new Error(UNGROUNDED_SUMMARY_MESSAGE);
  }
}

async function summarizeTextChunks(text, deadline = createSummaryDeadline()) {
  const chunks = splitIntoChunks(text);

  if (chunks.length === 0) {
    throw new Error('No content to summarize');
  }

  if (chunks.length > MAX_CHUNKS) {
    throw new Error(`PDF text is too large to summarize in one request (${chunks.length} chunks). Please upload a smaller PDF or increase AI_MAX_CHUNKS/AI_SUMMARY_TIMEOUT_MS on the server.`);
  }

  const summaries = [];

  for (const chunk of chunks) {
    const chunkSummary = await callOllamaGenerate(buildChunkPrompt(chunk), deadline);
    validateGeneratedSummary(chunkSummary, chunk);
    summaries.push(chunkSummary);
  }

  const summary = await mergeSummaries(summaries, deadline);
  validateGeneratedSummary(summary, text);

  return {
    chunkCount: chunks.length,
    summary,
  };
}

async function mergeSummaries(summaries, deadline) {
  let pending = summaries.filter(Boolean);

  while (pending.length > MERGE_BATCH_SIZE) {
    const next = [];

    for (let i = 0; i < pending.length; i += MERGE_BATCH_SIZE) {
      const batch = pending.slice(i, i + MERGE_BATCH_SIZE).join('\n\n');
      next.push(await callOllamaGenerate(buildMergePrompt(batch), deadline));
    }

    pending = next;
  }

  return await callOllamaGenerate(buildMergePrompt(pending.join('\n\n')), deadline);
}

async function summarizePdfBuffer(buffer, deadline = createSummaryDeadline()) {
  const text = await extractPdfText(buffer);
  return await summarizeTextChunks(text, deadline);
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

function looksLikeKnownHallucination(text) {
  return HALLUCINATION_PATTERNS.some((pattern) => pattern.test(normalizeText(text)));
}

async function summarizeCase(caseId, currentUser, deadline = createSummaryDeadline(), options = {}) {
  const caseData = await getCaseById(caseId, currentUser);
  const pdfName = pickLatestPdfFilename(caseData.documents || []);

  if (caseData.summary && !options.force && !looksLikeKnownHallucination(caseData.summary)) {
    return {
      chunkCount: 0,
      summary: caseData.summary,
      source: pdfName ? 'pdf' : 'text',
      document: pdfName,
      cached: true,
    };
  }

  let result;

  if (pdfName) {
    const pdfPath = join(UPLOAD_DIR, pdfName);

    if (!existsSync(pdfPath)) {
      throw new Error('PDF file not found on server');
    }

    result = await summarizePdfBuffer(await readFile(pdfPath), deadline);
    result = { ...result, source: 'pdf', document: pdfName };
  } else {
    const text = buildCaseText(caseData);
    result = { ...(await summarizeTextChunks(text, deadline)), source: 'text', document: null };
  }

  caseData.summary = result.summary;
  await caseData.save();

  return result;
}

export default async function aiRoutes(fastify) {
  fastify.post('/summarize', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    const deadline = createSummaryDeadline();

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

        result = await summarizePdfBuffer(await file.toBuffer(), deadline);
        result.source = 'pdf';
        result.document = file.filename;
      } else {
        const { case_id, text } = request.body || {};

        if (case_id) {
          result = await summarizeCase(case_id, request.currentUser, deadline, { force: request.body?.force === true });
        } else if (text && text.trim()) {
          result = { ...(await summarizeTextChunks(text, deadline)), source: 'text', document: null };
        } else {
          throw new Error('No content to summarize');
        }
      }

      return sendSuccess(reply, {
        data: {
          summary: result.summary,
          descriptionSummary: result.source === 'pdf' ? '' : result.summary,
          documentSummary: result.source === 'pdf' ? result.summary : '',
          status: 'success',
          source: result.source,
          document: result.document,
          chunkCount: result.chunkCount,
          cached: Boolean(result.cached),
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
    const deadline = createSummaryDeadline();
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

      const result = await summarizePdfBuffer(await readFile(tmpPath), deadline);

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
