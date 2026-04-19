import type { Kysely } from "kysely";

import type { DatabaseSchema } from "../../core/db/schema/database.js";
import type {
  ManualEntityRefs,
  PlanRetrievedContextEntityGroups,
  RetrievedChapterSummary,
  RetrievedEntity,
  RetrievedOutline,
} from "./types.js";

export interface RetrievePlanContextParams {
  bookId: number;
  chapterNo: number;
  keywords: string[];
  queryText: string;
  manualRefs: ManualEntityRefs;
}

export interface RetrievalCandidateBundle {
  outlines: RetrievedOutline[];
  recentChapters: RetrievedChapterSummary[];
  entityGroups: PlanRetrievedContextEntityGroups;
}

export interface RetrievalCandidateProvider {
  loadCandidates(
    db: Kysely<DatabaseSchema>,
    params: RetrievePlanContextParams,
  ): Promise<RetrievalCandidateBundle>;
}

export interface RetrievalRerankerInput {
  params: RetrievePlanContextParams;
  candidates: RetrievalCandidateBundle;
}

export interface RetrievalRerankerOutput {
  outlines: RetrievedOutline[];
  recentChapters: RetrievedChapterSummary[];
  entityGroups: PlanRetrievedContextEntityGroups;
}

export interface RetrievalReranker {
  rerank(input: RetrievalRerankerInput): Promise<RetrievalRerankerOutput>;
}

export class DirectPassThroughReranker implements RetrievalReranker {
  async rerank(input: RetrievalRerankerInput): Promise<RetrievalRerankerOutput> {
    return {
      outlines: input.candidates.outlines,
      recentChapters: input.candidates.recentChapters,
      entityGroups: input.candidates.entityGroups,
    };
  }
}

export interface RetrievalExperimentFormat {
  query: {
    bookId: number;
    chapterNo: number;
    keywords: string[];
    queryText: string;
    manualRefs: ManualEntityRefs;
  };
  candidates: PlanRetrievedContextEntityGroups;
  reranked: PlanRetrievedContextEntityGroups;
}
