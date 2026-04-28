import { readFile } from 'fs/promises';

let _pdfParse = null;

async function getPdfParse() {
  if (_pdfParse) return _pdfParse;

  // pdf-parse (via pdfjs) expects some browser globals in certain builds.
  if (typeof global.DOMMatrix === 'undefined') global.DOMMatrix = class DOMMatrix {};
  if (typeof global.Path2D === 'undefined') global.Path2D = class Path2D {};

  const mod = await import('pdf-parse');
  _pdfParse = mod.default || mod;
  return _pdfParse;
}

export async function extractPdfTextFromBuffer(buffer) {
  const pdfParse = await getPdfParse();
  const data = await pdfParse(buffer);
  return (data?.text || '').trim();
}

export async function extractPdfTextFromFile(filepath) {
  const buffer = await readFile(filepath);
  return await extractPdfTextFromBuffer(buffer);
}

