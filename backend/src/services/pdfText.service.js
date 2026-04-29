import { readFile } from 'fs/promises';

let _PDFParse = null;

async function getPdfParse() {
  if (_PDFParse) return _PDFParse;

  if (typeof global.DOMMatrix === 'undefined') global.DOMMatrix = class DOMMatrix {};
  if (typeof global.Path2D === 'undefined') global.Path2D = class Path2D {};

  const mod = await import('pdf-parse');
  _PDFParse = mod.PDFParse;

  if (!_PDFParse) {
    throw new Error('PDF parser is unavailable');
  }

  return _PDFParse;
}

export async function extractPdfTextFromBuffer(buffer) {
  const PDFParse = await getPdfParse();
  const parser = new PDFParse({ data: buffer });

  try {
    const data = await parser.getText();
    return (data?.text || '').trim();
  } finally {
    await parser.destroy();
  }
}

export async function extractPdfTextFromFile(filepath) {
  const buffer = await readFile(filepath);
  return await extractPdfTextFromBuffer(buffer);
}

