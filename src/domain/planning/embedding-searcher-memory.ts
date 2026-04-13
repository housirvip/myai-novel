import type {
  EmbeddingDocument,
  EmbeddingMatch,
  EmbeddingProvider,
  IndexedEmbeddingDocument,
} from "./embedding-types.js";
import type { EmbeddingCandidateSearcher } from "./embedding-candidate-provider.js";

export class InMemoryEmbeddingSearcher implements EmbeddingCandidateSearcher {
  private indexedDocuments: IndexedEmbeddingDocument[] = [];

  constructor(private readonly provider: EmbeddingProvider) {}

  async index(documents: EmbeddingDocument[]): Promise<void> {
    const vectors = await this.provider.embedBatch(documents.map((document) => document.text));
    this.indexedDocuments = documents.map((document, index) => ({
      ...document,
      vector: vectors[index] ?? [],
    }));
  }

  loadIndexedDocuments(documents: IndexedEmbeddingDocument[]): void {
    this.indexedDocuments = [...documents];
  }

  async search(params: { queryText: string; limit: number }): Promise<EmbeddingMatch[]> {
    if (this.indexedDocuments.length === 0) {
      return [];
    }

    const queryVector = await this.provider.embed(params.queryText);
    return this.indexedDocuments
      .map((document) => ({
        entityType: document.entityType,
        entityId: document.entityId,
        chunkKey: document.chunkKey,
        semanticScore: cosineSimilarity(queryVector, document.vector),
        displayName: document.displayName,
        text: document.text,
      }))
      .sort((left, right) => right.semanticScore - left.semanticScore || left.entityId - right.entityId)
      .slice(0, params.limit);
  }
}

function cosineSimilarity(left: number[], right: number[]): number {
  if (left.length === 0 || right.length === 0 || left.length !== right.length) {
    return 0;
  }

  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;

  for (let index = 0; index < left.length; index += 1) {
    const leftValue = left[index] ?? 0;
    const rightValue = right[index] ?? 0;
    dot += leftValue * rightValue;
    leftMagnitude += leftValue * leftValue;
    rightMagnitude += rightValue * rightValue;
  }

  if (leftMagnitude === 0 || rightMagnitude === 0) {
    return 0;
  }

  return dot / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude));
}
