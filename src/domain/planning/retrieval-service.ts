import { env } from "../../config/env.js";
import type { AppLogger } from "../../core/logger/index.js";
import { executeDbAction } from "../shared/service-helpers.js";
import { RuleBasedCandidateProvider } from "./retrieval-candidate-provider-rule.js";
import { buildRetrievedContext } from "./retrieval-context-builder.js";
import { createConfiguredReranker } from "./retrieval-reranker-factory.js";
import { EmbeddingCandidateProvider, type EmbeddingCandidateSearcher } from "./embedding-candidate-provider.js";
import { summarizeRetrievalObservability } from "./retrieval-observability.js";

import type {
  PlanRetrievedContext,
} from "./types.js";
import {
  type RetrievalCandidateProvider,
  type RetrievalReranker,
  type RetrievePlanContextParams,
} from "./retrieval-pipeline.js";
export class RetrievalQueryService {
  private readonly candidateProvider: RetrievalCandidateProvider;

  private readonly reranker: RetrievalReranker;

  constructor(
    private readonly logger: AppLogger,
    options?: {
      candidateProvider?: RetrievalCandidateProvider;
      reranker?: RetrievalReranker;
      embeddingSearcher?: EmbeddingCandidateSearcher;
      embeddingSearchMode?: "basic" | "hybrid";
    },
  ) {
    const baseProvider = options?.candidateProvider ?? new RuleBasedCandidateProvider();
    const embeddingSearchMode = options?.embeddingSearchMode ?? env.PLANNING_RETRIEVAL_EMBEDDING_SEARCH_MODE;
    const shouldEnableEmbedding = env.PLANNING_RETRIEVAL_EMBEDDING_PROVIDER !== "none" && options?.embeddingSearcher;

    // embedding 候选不是替换规则召回，而是包在 baseProvider 外层做增强。
    // 这样即使实验链路关闭，主流程仍然保留稳定的规则式召回基线。
    this.candidateProvider = shouldEnableEmbedding
      ? new EmbeddingCandidateProvider(baseProvider, options.embeddingSearcher!, {
          limit: embeddingSearchMode === "hybrid"
            ? env.PLANNING_RETRIEVAL_EMBEDDING_LIMIT_HYBRID
            : env.PLANNING_RETRIEVAL_EMBEDDING_LIMIT_BASIC,
        })
      : baseProvider;
    this.reranker = options?.reranker ?? createConfiguredReranker();
  }

  // 这里产出的不是只给 plan 自己看的临时检索结果，
  // 而是会被固化进 chapter_plans.retrieved_context、并被后续 draft/review/repair/approve 复用的共享上下文。
  async retrievePlanContext(params: RetrievePlanContextParams): Promise<PlanRetrievedContext> {
    return executeDbAction(
      this.logger,
      {
        event: "planning.retrieve",
        entityType: "plan_context",
        bookId: params.bookId,
        chapterNo: params.chapterNo,
      },
      async (db) => {
        const book = await db
          .selectFrom("books")
          .selectAll()
          .where("id", "=", params.bookId)
          .executeTakeFirst();

        if (!book) {
          throw new Error(`Book not found: ${params.bookId}`);
        }

        const candidates = await this.candidateProvider.loadCandidates(db, params);
        const reranked = await this.reranker.rerank({
          params,
          candidates,
        });

        // 这里先产出完整上下文，再额外记录 observability 摘要；
        // 观测日志是为了调 retrieval 质量，不应反向影响实际写入 plan 的上下文内容。
        const context = buildRetrievedContext({ params, book, candidates, reranked });
        if (context.retrievalObservability) {
          this.logger.info(
            {
              event: "planning.retrieve.observability",
              bookId: params.bookId,
              chapterNo: params.chapterNo,
              ...summarizeRetrievalObservability(context.retrievalObservability),
            },
            "Planning retrieval observability summary",
          );
        }

        return context;
      },
    );
  }

}
