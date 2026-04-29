import { existsSync } from 'fs';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';

import { badRequest, notFound } from '../utils/errors.js';
import { getCaseById } from './case.service.js';
import { extractPdfTextFromFile } from './pdfText.service.js';
import { chunkText } from '../utils/textChunker.js';
import { generateSummaryViaNgrok } from './ollamaNgrok.service.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = join(__dirname, '..', '..', 'uploads');
const PDF_CHUNK_SIZE = Number.parseInt(process.env.AI_PDF_CHUNK_SIZE || '3000', 10);
const MAX_CHUNKS = Number.parseInt(process.env.AI_MAX_CHUNKS || '14', 10);
const OLLAMA_CALL_TIMEOUT_MS = Number.parseInt(process.env.OLLAMA_CALL_TIMEOUT_MS || '90000', 10);
const MERGE_BATCH_SIZE = 6;
const MIN_FINAL_SUMMARY_WORDS = Number.parseInt(process.env.AI_MIN_SUMMARY_WORDS || '150', 10);
const MAX_FINAL_SUMMARY_WORDS = Number.parseInt(process.env.AI_MAX_SUMMARY_WORDS || '200', 10);

function pickLatestPdfFilename(documents = []) {
  for (let i = documents.length - 1; i >= 0; i--) {
    const name = documents[i];
    if (typeof name !== 'string') continue;
    if (extname(name).toLowerCase() === '.pdf') return name;
  }
  return null;
}

function buildChunkPrompt(text) {
  return `Summarize this document section for a lawyer.
Use only the given text. Do not add facts, names, dates, disputes, or legal claims that are not present.

Return:
- Key facts
- Legal issues
- Important dates/names
- Conclusion

${text}`;
}

function buildMergePrompt(text) {
  return `Merge these partial summaries into one final summary. Use only given text.
The final answer must be ${MIN_FINAL_SUMMARY_WORDS} to ${MAX_FINAL_SUMMARY_WORDS} words.

Output format exactly:
Overview:
Key Facts:
Legal Points:
Conclusion:

${text}`;
}

function buildFinalSummaryPrompt(text) {
  return `Create the final case summary of this uploaded document for a lawyer.
Use only the given text. Do not add facts, names, dates, disputes, or legal claims that are not present.
The final answer must be ${MIN_FINAL_SUMMARY_WORDS} to ${MAX_FINAL_SUMMARY_WORDS} words.

Output format exactly:
Overview:
Key Facts:
Legal Points:
Conclusion:

${text}`;
}

function buildLengthRevisionPrompt(summary, sourceText) {
  return `Revise the summary so it is ${MIN_FINAL_SUMMARY_WORDS} to ${MAX_FINAL_SUMMARY_WORDS} words.
Use only facts supported by the source text. Keep the same output headings exactly:
Overview:
Key Facts:
Legal Points:
Conclusion:

Current summary:
${summary}

Source text:
${sourceText}`;
}

function countWords(text) {
  return String(text || '').trim().match(/\b[\w'/-]+\b/g)?.length || 0;
}

async function mergeSummaries(summaries) {
  let pending = summaries.filter(Boolean);

  while (pending.length > MERGE_BATCH_SIZE) {
    const next = [];

    for (let i = 0; i < pending.length; i += MERGE_BATCH_SIZE) {
      const batch = pending.slice(i, i + MERGE_BATCH_SIZE).join('\n\n');
      next.push(await generateSummaryViaNgrok({
        prompt: buildMergePrompt(batch),
        timeoutMs: OLLAMA_CALL_TIMEOUT_MS,
      }));
    }

    pending = next;
  }

  return await generateSummaryViaNgrok({
    prompt: buildMergePrompt(pending.join('\n\n')),
    timeoutMs: OLLAMA_CALL_TIMEOUT_MS,
  });
}

async function reviseSummaryLengthIfNeeded(summary, sourceText) {
  const words = countWords(summary);
  if (words >= MIN_FINAL_SUMMARY_WORDS && words <= MAX_FINAL_SUMMARY_WORDS) {
    return summary;
  }

  return await generateSummaryViaNgrok({
    prompt: buildLengthRevisionPrompt(summary, sourceText),
    timeoutMs: OLLAMA_CALL_TIMEOUT_MS,
  });
}

export async function summarizeCasePdf({ caseId, currentUser }) {
  const found = await getCaseById(caseId, currentUser);
  if (!found) throw notFound(`Case ${caseId} not found`);

  const pdfName = pickLatestPdfFilename(found.documents || []);
  if (!pdfName) {
    throw badRequest('No PDF document found for this case');
  }

  const pdfPath = join(UPLOAD_DIR, pdfName);
  if (!existsSync(pdfPath)) {
    throw notFound('PDF file not found on server');
  }

  const text = await extractPdfTextFromFile(pdfPath);
  if (!text || !text.trim()) {
    throw badRequest('Could not extract readable text from this PDF');
  }

  const chunks = chunkText(text, PDF_CHUNK_SIZE);
  if (chunks.length === 0) {
    throw badRequest('PDF text is empty after extraction');
  }
  if (chunks.length > MAX_CHUNKS) {
    throw badRequest('PDF text is too large to summarize safely');
  }

  let finalSummary;

  if (chunks.length === 1) {
    finalSummary = await generateSummaryViaNgrok({
      prompt: buildFinalSummaryPrompt(chunks[0]),
      timeoutMs: OLLAMA_CALL_TIMEOUT_MS,
    });
  } else {
    const chunkSummaries = [];
    for (let idx = 0; idx < chunks.length; idx++) {
      const summary = await generateSummaryViaNgrok({
        prompt: buildChunkPrompt(chunks[idx]),
        timeoutMs: OLLAMA_CALL_TIMEOUT_MS,
      });
      chunkSummaries.push(`Chunk ${idx + 1} Summary:\n${summary}`.trim());
    }

    finalSummary = await mergeSummaries(chunkSummaries);
  }

  finalSummary = await reviseSummaryLengthIfNeeded(finalSummary, text);

  found.summary = finalSummary;
  await found.save();

  return {
    case: found,
    document: pdfName,
    chunkCount: chunks.length,
    summary: finalSummary,
  };
}

