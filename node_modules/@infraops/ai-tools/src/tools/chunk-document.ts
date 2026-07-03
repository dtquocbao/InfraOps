const DEFAULT_CHUNK_SIZE = 800;
const DEFAULT_OVERLAP = 100;

export function chunkText(text: string, chunkSize = DEFAULT_CHUNK_SIZE, overlap = DEFAULT_OVERLAP): string[] {
  const normalized = text.replace(/\r\n/g, '\n').trim();
  if (!normalized) return [];

  const paragraphs = normalized.split(/\n{2,}/);
  const chunks: string[] = [];
  let current = '';

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) continue;

    if ((current + '\n\n' + trimmed).length <= chunkSize) {
      current = current ? `${current}\n\n${trimmed}` : trimmed;
    } else {
      if (current) chunks.push(current);
      if (trimmed.length <= chunkSize) {
        current = trimmed;
      } else {
        for (let i = 0; i < trimmed.length; i += chunkSize - overlap) {
          chunks.push(trimmed.slice(i, i + chunkSize));
        }
        current = '';
      }
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

export function searchProjectDocuments(
  query: string,
  _filters: { projectId?: string; discipline?: string; docType?: string },
): never {
  throw new Error('Use RetrieverAdapter.search via injected dependency');
}
