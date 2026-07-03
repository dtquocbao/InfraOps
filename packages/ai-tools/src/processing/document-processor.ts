import * as fs from 'fs/promises';
import { chunkText } from '../tools/chunk-document';
import { createEmbeddingAdapter } from '../embeddings/adapter';

export interface DocumentProcessorDb {
  document: {
    findUnique: (args: { where: { id: string } }) => Promise<{
      id: string;
      storageUri: string;
    } | null>;
    update: (args: { where: { id: string }; data: { processingStatus: string } }) => Promise<unknown>;
  };
  documentChunk: {
    deleteMany: (args: { where: { documentId: string } }) => Promise<unknown>;
  };
  $executeRawUnsafe: (query: string, ...values: unknown[]) => Promise<number>;
}

export async function processDocument(
  prisma: DocumentProcessorDb,
  documentId: string,
  openaiKey?: string,
) {
  const doc = await prisma.document.findUnique({ where: { id: documentId } });
  if (!doc) throw new Error(`Document ${documentId} not found`);

  await prisma.document.update({
    where: { id: documentId },
    data: { processingStatus: 'parsing' },
  });

  const content = await fs.readFile(doc.storageUri, 'utf-8');

  await prisma.document.update({
    where: { id: documentId },
    data: { processingStatus: 'chunking' },
  });

  await prisma.documentChunk.deleteMany({ where: { documentId } });
  const chunks = chunkText(content);

  await prisma.document.update({
    where: { id: documentId },
    data: { processingStatus: 'embedding' },
  });

  const embedder = createEmbeddingAdapter(openaiKey);
  const embeddings = await embedder.embedBatch(chunks);

  await prisma.document.update({
    where: { id: documentId },
    data: { processingStatus: 'indexing' },
  });

  for (let i = 0; i < chunks.length; i++) {
    const chunkId = `${documentId}-chunk-${i}`;
    const embedding = embeddings[i];
    const vectorStr = `[${embedding.join(',')}]`;

    await prisma.$executeRawUnsafe(
      `INSERT INTO document_chunks (id, document_id, content, embedding, metadata, chunk_index)
       VALUES ($1, $2, $3, $4::vector, $5::jsonb, $6)`,
      chunkId,
      documentId,
      chunks[i],
      vectorStr,
      JSON.stringify({ chunkIndex: i }),
      i,
    );
  }

  await prisma.document.update({
    where: { id: documentId },
    data: { processingStatus: 'ready' },
  });

  return { documentId, chunkCount: chunks.length, status: 'ready' as const };
}
