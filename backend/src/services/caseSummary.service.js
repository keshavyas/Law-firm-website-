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

function pickLatestPdfFilename(documents = []) {
  for (let i = documents.length - 1; i >= 0; i--) {
    const name = documents[i];
    if (typeof name !== 'string') continue;
    if (extname(name).toLowerCase() === '.pdf') return name;
  }
  return null;
}

function buildChunkPrompt(text) {
  return `You are a legal assistant. Summarize with key facts, dates, and client obligations.\n\n${text}`;
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

  const chunks = chunkText(text, 3000);
  if (chunks.length === 0) {
    throw badRequest('PDF text is empty after extraction');
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

  const combined = chunkSummaries.join('\n\n---\n\n');

  // Final pass: ask for a coherent combined summary.
  // Keep within a reasonable size for the local model.
  const finalInput = combined.length > 12000 ? combined.slice(0, 12000) + '\n\n[truncated]' : combined;
  const finalSummary = await generateSummaryViaNgrok({
    model: 'phi',
    prompt: buildChunkPrompt(finalInput),
    timeoutMs: 60000,
  });

  found.summary = finalSummary;
  await found.save();

  return {
    case: found,
    document: pdfName,
    chunkCount: chunks.length,
    summary: finalSummary,
  };
}

