export interface EmbeddingAdapter {
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
  dimensions: number;
}

/** Deterministic fallback when no API key - keyword search carries retrieval quality */
export class HashEmbeddingAdapter implements EmbeddingAdapter {
  readonly dimensions = 1536;

  async embed(text: string): Promise<number[]> {
    return this.hashToVector(text);
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    return texts.map((t) => this.hashToVector(t));
  }

  private hashToVector(text: string): number[] {
    const vec = new Array(this.dimensions).fill(0);
    for (let i = 0; i < text.length; i++) {
      const idx = (text.charCodeAt(i) * (i + 1)) % this.dimensions;
      vec[idx] += 1;
    }
    const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
    return vec.map((v) => v / norm);
  }
}

export class OpenAiEmbeddingAdapter implements EmbeddingAdapter {
  readonly dimensions = 1536;

  constructor(private apiKey: string) {}

  async embed(text: string): Promise<number[]> {
    const [result] = await this.embedBatch([text]);
    return result;
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: texts,
      }),
    });
    if (!res.ok) {
      throw new Error(`OpenAI embedding failed: ${res.status} ${await res.text()}`);
    }
    const data = (await res.json()) as { data: { embedding: number[]; index: number }[] };
    return data.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
  }
}

export function createEmbeddingAdapter(apiKey?: string): EmbeddingAdapter {
  if (apiKey?.trim()) return new OpenAiEmbeddingAdapter(apiKey);
  return new HashEmbeddingAdapter();
}
