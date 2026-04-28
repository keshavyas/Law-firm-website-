export function chunkText(text, chunkSize = 3000) {
  const src = (text || '').replace(/\r\n/g, '\n').trim();
  if (!src) return [];
  if (src.length <= chunkSize) return [src];

  const chunks = [];
  let i = 0;

  while (i < src.length) {
    const end = Math.min(i + chunkSize, src.length);
    const window = src.slice(i, end);

    // Prefer breaking at paragraph boundary, then sentence-ish boundary, else hard split.
    let cut = window.lastIndexOf('\n\n');
    if (cut < Math.floor(chunkSize * 0.5)) cut = window.lastIndexOf('\n');
    if (cut < Math.floor(chunkSize * 0.5)) cut = window.lastIndexOf('. ');
    if (cut < Math.floor(chunkSize * 0.5)) cut = window.lastIndexOf(' ');
    if (cut < 0) cut = window.length;

    const piece = window.slice(0, cut).trim();
    if (piece) chunks.push(piece);

    // Advance; avoid infinite loop if cut is 0 for some reason
    i += Math.max(cut, 1);
  }

  return chunks;
}

