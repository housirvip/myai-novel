import type {
  EmbeddingDocument,
  EmbeddingMatch,
  EmbeddingProvider,
  IndexedEmbeddingDocument,
} from "./embedding-types.js";
import type { EmbeddingCandidateSearcher } from "./embedding-candidate-provider.js";

export class HybridEmbeddingSearcher implements EmbeddingCandidateSearcher {
  private indexedDocuments: IndexedEmbeddingDocument[] = [];

  constructor(
    private readonly provider: EmbeddingProvider,
    private readonly options: { semanticWeight?: number; lexicalWeight?: number } = {},
  ) {}

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
    const queryTokens = tokenize(params.queryText);
    const ruleHeavyQuery = isRuleHeavyQuery(queryTokens);
    const semanticWeight = this.options.semanticWeight ?? (ruleHeavyQuery ? 0.45 : 0.55);
    const lexicalWeight = this.options.lexicalWeight ?? (ruleHeavyQuery ? 0.55 : 0.45);

    return this.indexedDocuments
      .map((document) => {
        const semanticScore = cosineSimilarity(queryVector, document.vector);
        const lexicalScore = lexicalOverlap(queryTokens, tokenize(document.text));
        const combinedScore = semanticScore * semanticWeight
          + lexicalScore * lexicalWeight
          + entityTypeBonus(document.entityType, lexicalScore, ruleHeavyQuery);

        return {
          entityType: document.entityType,
          entityId: document.entityId,
          chunkKey: document.chunkKey,
          semanticScore: combinedScore,
          displayName: document.displayName,
          text: document.text,
        } satisfies EmbeddingMatch;
      })
      .sort((left, right) => right.semanticScore - left.semanticScore || left.entityId - right.entityId)
      .slice(0, params.limit);
  }
}

function isRuleHeavyQuery(queryTokens: string[]): boolean {
  return queryTokens.some((token) => ["规则", "制度", "令牌", "登记"].includes(token));
}

function entityTypeBonus(
  entityType: EmbeddingDocument["entityType"],
  lexicalScore: number,
  ruleHeavyQuery: boolean,
): number {
  if (!ruleHeavyQuery || lexicalScore <= 0) {
    return 0;
  }

  if (entityType === "world_setting") {
    return 0.08;
  }

  if (entityType === "faction") {
    return 0.03;
  }

  return 0;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}_]+/u)
    .map((item) => item.trim())
    .filter(Boolean);
}

function lexicalOverlap(queryTokens: string[], documentTokens: string[]): number {
  if (queryTokens.length === 0 || documentTokens.length === 0) {
    return 0;
  }

  const documentSet = new Set(documentTokens);
  const hits = queryTokens.filter((token) => documentSet.has(token)).length;
  return hits / queryTokens.length;
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
