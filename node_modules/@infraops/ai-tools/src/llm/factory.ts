import { StubLlmAdapter } from './adapter';
import type { LlmAdapter, LlmMessage, LlmCompletionOptions, LlmCompletionResult } from './adapter';

export class AnthropicLlmAdapter implements LlmAdapter {
  constructor(private apiKey: string, private model = 'claude-sonnet-4-20250514') {}

  async complete(messages: LlmMessage[], options?: LlmCompletionOptions): Promise<LlmCompletionResult> {
    const system = messages.find((m) => m.role === 'system')?.content ?? '';
    const chatMessages = messages.filter((m) => m.role !== 'system');

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: options?.model ?? this.model,
        max_tokens: options?.maxTokens ?? 1024,
        temperature: options?.temperature ?? 0.2,
        system,
        messages: chatMessages.map((m) => ({ role: m.role, content: m.content })),
      }),
    });

    if (!res.ok) {
      throw new Error(`Anthropic API failed: ${res.status} ${await res.text()}`);
    }

    const data = (await res.json()) as {
      content: { type: string; text: string }[];
      usage: { input_tokens: number; output_tokens: number };
      model: string;
    };

    const text = data.content.find((c) => c.type === 'text')?.text ?? '';
    return {
      content: text,
      model: data.model,
      inputTokens: data.usage.input_tokens,
      outputTokens: data.usage.output_tokens,
    };
  }
}

export class OpenAiLlmAdapter implements LlmAdapter {
  constructor(private apiKey: string, private model = 'gpt-4o-mini') {}

  async complete(messages: LlmMessage[], options?: LlmCompletionOptions): Promise<LlmCompletionResult> {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: options?.model ?? this.model,
        max_tokens: options?.maxTokens ?? 1024,
        temperature: options?.temperature ?? 0.2,
        messages,
      }),
    });

    if (!res.ok) {
      throw new Error(`OpenAI API failed: ${res.status} ${await res.text()}`);
    }

    const data = (await res.json()) as {
      choices: { message: { content: string } }[];
      usage: { prompt_tokens: number; completion_tokens: number };
      model: string;
    };

    return {
      content: data.choices[0]?.message?.content ?? '',
      model: data.model,
      inputTokens: data.usage.prompt_tokens,
      outputTokens: data.usage.completion_tokens,
    };
  }
}

export function createLlmAdapter(config: {
  anthropicKey?: string;
  openaiKey?: string;
}): LlmAdapter {
  if (config.anthropicKey?.trim()) {
    return new AnthropicLlmAdapter(config.anthropicKey);
  }
  if (config.openaiKey?.trim()) {
    return new OpenAiLlmAdapter(config.openaiKey);
  }
  return new StubLlmAdapter();
}
