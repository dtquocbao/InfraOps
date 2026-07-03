export interface LlmMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LlmCompletionOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface LlmCompletionResult {
  content: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

export interface LlmAdapter {
  complete(messages: LlmMessage[], options?: LlmCompletionOptions): Promise<LlmCompletionResult>;
}

/** Stub adapter - synthesizes answer from retrieved context when no LLM key is set */
export class StubLlmAdapter implements LlmAdapter {
  async complete(messages: LlmMessage[]): Promise<LlmCompletionResult> {
    const userMsg = [...messages].reverse().find((m) => m.role === 'user')?.content ?? '';
    const questionLine = userMsg.match(/\n\nQuestion:\s*([^\n]+)/);
    const question = questionLine?.[1]?.trim() ?? 'the question';
    const contextMatch = userMsg.match(/Context:\n([\s\S]*?)\n\nQuestion:/);
    const context = contextMatch?.[1]?.trim() ?? '';

    if (context) {
      // Prefer body text after source headers so groundedness scoring has real overlap.
      const bodies = context
        .split(/\n\n---\n\n/)
        .map((block) => {
          const lines = block.split('\n');
          const start = lines[0]?.startsWith('[Source') ? 1 : 0;
          return lines.slice(start).join('\n').trim();
        })
        .filter(Boolean)
        .slice(0, 3);

      const excerpt = bodies.join('\n\n').slice(0, 1200);
      return {
        content:
          `Based on Meridian Grid Services source documents for "${question}":\n\n` +
          `${excerpt}\n\n` +
          `The answer above is grounded in the retrieved document excerpts.`,
        model: 'stub-context',
        inputTokens: 0,
        outputTokens: 0,
      };
    }

    return {
      content: `[Stub] No context retrieved for: "${question}"`,
      model: 'stub',
      inputTokens: 0,
      outputTokens: 0,
    };
  }
}
