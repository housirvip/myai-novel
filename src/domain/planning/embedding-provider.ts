import type { EmbeddingProvider } from "./embedding-types.js";

export class DeterministicHashEmbeddingProvider implements EmbeddingProvider {
  constructor(private readonly dimensions = 32) {}

  async embed(text: string): Promise<number[]> {
    return this.embedText(text);
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    return texts.map((text) => this.embedText(text));
  }

  private embedText(text: string): number[] {
    const vector = new Array<number>(this.dimensions).fill(0);
    const tokens = tokenize(text);

    for (const token of tokens) {
      const bucket = hashToken(token) % this.dimensions;
      vector[bucket] += 1;
    }

    return normalize(vector);
  }
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}_]+/u)
    .map((item) => item.trim())
    .filter(Boolean);
}

function hashToken(token: string): number {
  let hash = 0;
  for (let index = 0; index < token.length; index += 1) {
    hash = (hash * 31 + token.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function normalize(vector: number[]): number[] {
  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  if (magnitude === 0) {
    return vector;
  }

  return vector.map((value) => value / magnitude);
}
