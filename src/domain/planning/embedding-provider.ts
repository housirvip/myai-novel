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
    // 这是本地可复现的占位 embedding：
    // 它不追求语义质量，主要用于离线测试、基线对比和在没有远端 embedding 服务时保持链路可跑通。
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
  // 归一化后，向量比较更接近“方向相似度”而不是“文本长度相似度”，
  // 否则长文本会仅因 token 更多就在后续相似度计算里天然占优。
  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  if (magnitude === 0) {
    return vector;
  }

  return vector.map((value) => value / magnitude);
}
