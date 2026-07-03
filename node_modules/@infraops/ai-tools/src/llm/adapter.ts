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
    const questionMatch = userMsg.match(/Question:\s*(.+)/s);
    const question = questionMatch?.[1]?.trim() ?? userMsg;
    const contextMatch = userMsg.match(/Context:\n([\s\S]*?)\n\nQuestion:/);
    const context = contextMatch?.[1] ?? '';

    if (context) {
      const firstSource = context.split('---')[0]?.trim() ?? context.slice(0, 500);
      return {
        content: `Based on the retrieved Meridian Grid Services documents:\n\n${firstSource.slice(0, 600)}...\n\nThis addresses your question: "${question}"`,
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
