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
const PDF_CHUNK_SIZE = 1200;
const MAX_CHUNKS = 80;
const MERGE_BATCH_SIZE = 8;

function pickLatestPdfFilename(documents = []) {
  for (let i = documents.length - 1; i >= 0; i--) {
    const name = documents[i];
    if (typeof name !== 'string') continue;
    if (extname(name).toLowerCase() === '.pdf') return name;
  }
  return null;
}

function buildChunkPrompt(text) {
  return `Summarize into key facts and conclusion. Use only given text.\n\n${text}`;
}

function buildMergePrompt(text) {
  return `Merge these partial summaries into one final summary. Use only given text.

Output format exactly:
Overview:
Key Facts:
Legal Points:
Conclusion:

${text}`;
}

async function mergeSummaries(summaries) {
  let pending = summaries.filter(Boolean);

  while (pending.length > MERGE_BATCH_SIZE) {
    const next = [];

    for (let i = 0; i < pending.length; i += MERGE_BATCH_SIZE) {
      const batch = pending.slice(i, i + MERGE_BATCH_SIZE).join('\n\n');
      next.push(await generateSummaryViaNgrok({
        model: 'phi',
        prompt: buildMergePrompt(batch),
        timeoutMs: 60000,
      }));
    }

    pending = next;
  }

  return await generateSummaryViaNgrok({
    model: 'phi',
    prompt: buildMergePrompt(pending.join('\n\n')),
    timeoutMs: 60000,
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

  const chunkSummaries = [];
  for (let idx = 0; idx < chunks.length; idx++) {
    const summary = await generateSummaryViaNgrok({
      model: 'phi',
      prompt: buildChunkPrompt(chunks[idx]),
      timeoutMs: 45000,
    });
    chunkSummaries.push(`Chunk ${idx + 1} Summary:\n${summary}`.trim());
  }

  const finalSummary = await mergeSummaries(chunkSummaries);

  found.summary = finalSummary;
  await found.save();

  return {
    case: found,
    document: pdfName,
    chunkCount: chunks.length,
    summary: finalSummary,
  };
}

