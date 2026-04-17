import { env } from "../../config/env.js";
import type { EmbeddingProvider } from "./embedding-types.js";

interface CustomEmbeddingResponse {
  data?: Array<{
    index?: number;
    embedding?: number[];
  }>;
}

export class CustomRemoteEmbeddingProvider implements EmbeddingProvider {
  async embed(text: string): Promise<number[]> {
    const [vector] = await this.embedBatch([text]);
    return vector ?? [];
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }

    const baseUrl = env.CUSTOM_EMBEDDING_BASE_URL;
    if (!baseUrl) {
      throw new Error("CUSTOM_EMBEDDING_BASE_URL is required when PLANNING_RETRIEVAL_EMBEDDING_PROVIDER=custom");
    }

    const apiKey = env.CUSTOM_EMBEDDING_API_KEY;
    if (!apiKey) {
      throw new Error("CUSTOM_EMBEDDING_API_KEY is required when PLANNING_RETRIEVAL_EMBEDDING_PROVIDER=custom");
    }

    const response = await fetch(buildEmbeddingUrl(baseUrl, env.CUSTOM_EMBEDDING_PATH), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: env.CUSTOM_EMBEDDING_MODEL,
        input: texts,
      }),
    });

    if (!response.ok) {
      throw new Error(`Custom embedding request failed: ${response.status} ${await response.text()}`);
    }

    const raw = (await response.json()) as CustomEmbeddingResponse;
    const embeddings = normalizeEmbeddings(raw, texts.length);
    if (embeddings.length !== texts.length) {
      throw new Error(`Custom embedding response count mismatch: expected ${texts.length}, got ${embeddings.length}`);
    }

    return embeddings;
  }
}

function buildEmbeddingUrl(baseUrl: string, requestPath: string): string {
  return `${baseUrl.replace(/\/$/, "")}/${requestPath.replace(/^\//, "")}`;
}

function normalizeEmbeddings(raw: CustomEmbeddingResponse, expectedCount: number): number[][] {
  const data = raw.data ?? [];
  if (data.length === 0 && expectedCount > 0) {
    throw new Error("Custom embedding response did not include embedding data");
  }

  return [...data]
    .sort((left, right) => (left.index ?? 0) - (right.index ?? 0))
    .map((item) => {
      if (!Array.isArray(item.embedding)) {
        throw new Error("Custom embedding response contained invalid embedding vector");
      }
      return item.embedding;
    });
}
