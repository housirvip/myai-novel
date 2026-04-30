import { env } from "../../config/env.js";
import type { EmbeddingProvider } from "./embedding-types.js";

const MAX_CUSTOM_EMBEDDING_INPUT_CHARS = 8192;

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

    const sanitizedTexts = texts.map((text) => sanitizeEmbeddingInput(text));

    const baseUrl = env.CUSTOM_EMBEDDING_BASE_URL;
    if (!baseUrl) {
      throw new Error("CUSTOM_EMBEDDING_BASE_URL is required when PLANNING_RETRIEVAL_EMBEDDING_PROVIDER=custom");
    }

    const apiKey = env.CUSTOM_EMBEDDING_API_KEY;
    if (!apiKey) {
      throw new Error("CUSTOM_EMBEDDING_API_KEY is required when PLANNING_RETRIEVAL_EMBEDDING_PROVIDER=custom");
    }

    const chunks = chunkTexts(sanitizedTexts, env.CUSTOM_EMBEDDING_BATCH_SIZE);
    const embeddings: number[][] = [];

    for (const chunk of chunks) {
      const response = await fetch(buildEmbeddingUrl(baseUrl, env.CUSTOM_EMBEDDING_PATH), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: env.CUSTOM_EMBEDDING_MODEL,
          input: chunk,
        }),
      });

      if (!response.ok) {
        throw new Error(`Custom embedding request failed: ${response.status} ${await response.text()}`);
      }

      const raw = (await response.json()) as CustomEmbeddingResponse;
      const chunkEmbeddings = normalizeEmbeddings(raw, chunk.length);
      if (chunkEmbeddings.length !== chunk.length) {
        throw new Error(
          `Custom embedding response count mismatch: expected ${chunk.length}, got ${chunkEmbeddings.length}`,
        );
      }

      embeddings.push(...chunkEmbeddings);
    }

    if (embeddings.length !== sanitizedTexts.length) {
      throw new Error(
        `Custom embedding response count mismatch: expected ${sanitizedTexts.length}, got ${embeddings.length}`,
      );
    }

    return embeddings;
  }
}

function sanitizeEmbeddingInput(text: string): string {
  const normalized = text.trim().slice(0, MAX_CUSTOM_EMBEDDING_INPUT_CHARS);
  return normalized.length > 0 ? normalized : " ";
}

function chunkTexts(texts: string[], batchSize: number): string[][] {
  const chunks: string[][] = [];

  for (let index = 0; index < texts.length; index += batchSize) {
    chunks.push(texts.slice(index, index + batchSize));
  }

  return chunks;
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
