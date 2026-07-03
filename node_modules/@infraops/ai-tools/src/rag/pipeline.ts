import type { ChunkResult, Citation } from '@infraops/shared';
import type { LlmAdapter, LlmMessage } from '../llm/adapter';

export interface RagPipelineInput {
  question: string;
  chunks: ChunkResult[];
}

export interface RagPipelineResult {
  answer: string;
  citations: Citation[];
  tokenCount: number;
  confidence: number;
}

const SYSTEM_PROMPT = `You are an AI assistant for Meridian Grid Services, an energy-infrastructure EPC company.
Answer ONLY using the provided context documents. If the context does not contain enough information, say so clearly.
Always ground your answer in the source material. Be concise and professional.`;

export async function runRagPipeline(
  llm: LlmAdapter,
  input: RagPipelineInput,
): Promise<RagPipelineResult> {
  const { question, chunks } = input;

  if (chunks.length === 0) {
    return {
      answer: 'I could not find relevant documents to answer your question. Try rephrasing or check document access permissions.',
      citations: [],
      tokenCount: 0,
      confidence: 0,
    };
  }

  const context = chunks
    .map(
      (c, i) =>
        `[Source ${i + 1}] doc_id=${c.documentId} chunk_id=${c.chunkId} title="${c.title}" rev=${c.revision}\n${c.content}`,
    )
    .join('\n\n---\n\n');

  const messages: LlmMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    {
      role: 'user',
      content: `Context:\n${context}\n\nQuestion: ${question}\n\nProvide a grounded answer referencing the sources.`,
    },
  ];

  const result = await llm.complete(messages, { maxTokens: 1024, temperature: 0.2 });

  const citations: Citation[] = chunks.map((c) => ({
    documentId: c.documentId,
    chunkId: c.chunkId,
    title: c.title,
    revision: c.revision,
    excerpt: c.content.slice(0, 200),
  }));

  const avgScore = chunks.reduce((s, c) => s + c.score, 0) / chunks.length;
  const confidence = Math.min(1, Math.max(0, avgScore));

  return {
    answer: result.content,
    citations,
    tokenCount: result.inputTokens + result.outputTokens,
    confidence,
  };
}
