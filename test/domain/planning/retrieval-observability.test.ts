import assert from "node:assert/strict";
import test from "node:test";

import { summarizePromptContextObserved, summarizeRetrievalObservability } from "../../../src/domain/planning/retrieval-observability.js";
import type { PlanRetrievalObservability } from "../../../src/domain/planning/types.js";

test("summarizePromptContextObserved aggregates clipping losses and far-chapter surfaced refs", () => {
  const summary = summarizePromptContextObserved({
    charBudget: 5200,
    sections: {
      mustFollowFacts: { inputCount: 3, outputCount: 2, lineLimitDropped: 1, budgetDropped: 0, clippedCount: 1 },
      recentChanges: { inputCount: 2, outputCount: 1, lineLimitDropped: 0, budgetDropped: 1, clippedCount: 0 },
      coreEntities: { inputCount: 1, outputCount: 1, lineLimitDropped: 0, budgetDropped: 0, clippedCount: 0 },
      requiredHooks: { inputCount: 1, outputCount: 1, lineLimitDropped: 0, budgetDropped: 0, clippedCount: 0 },
      forbiddenMoves: { inputCount: 1, outputCount: 1, lineLimitDropped: 0, budgetDropped: 0, clippedCount: 0 },
      supportingBackground: { inputCount: 1, outputCount: 0, lineLimitDropped: 0, budgetDropped: 1, clippedCount: 0 },
    },
    surfacedPersistedRefs: [
      { section: "mustFollowFacts", source: { sourceType: "persisted_fact", sourceId: 1 }, chapterGap: 2, selectedBy: "top_k" },
      { section: "recentChanges", source: { sourceType: "persisted_event", sourceId: 2 }, chapterGap: 17, selectedBy: "long_tail_reserve" },
    ],
  });

  assert.equal(summary?.charBudget, 5200);
  assert.equal(summary?.surfacedPersistedRefCount, 2);
  assert.equal(summary?.farChapterSurfacedPersistedRefCount, 1);
  assert.equal(summary?.farChapterSurfacedPersistedRefRatio, 0.5);
  assert.deepEqual(summary?.sectionLossTotals, {
    lineLimitDropped: 1,
    budgetDropped: 2,
    clippedCount: 1,
  });
});

test("summarizeRetrievalObservability reports long-tail provenance and prompt context summary", () => {
  const observability: PlanRetrievalObservability = {
    query: { chapterNo: 20, keywordCount: 3, queryTextLength: 12 },
    candidateVolumes: {
      beforeRerank: {
        hooks: { total: 0, rule: 0, embeddingSupport: 0, embeddingOnly: 0, entityType: "hook" },
        characters: { total: 0, rule: 0, embeddingSupport: 0, embeddingOnly: 0, entityType: "character" },
        factions: { total: 0, rule: 0, embeddingSupport: 0, embeddingOnly: 0, entityType: "faction" },
        items: { total: 0, rule: 0, embeddingSupport: 0, embeddingOnly: 0, entityType: "item" },
        relations: { total: 0, rule: 0, embeddingSupport: 0, embeddingOnly: 0, entityType: "relation" },
        worldSettings: { total: 0, rule: 0, embeddingSupport: 0, embeddingOnly: 0, entityType: "world_setting" },
      },
      afterRerank: {
        hooks: { total: 0, rule: 0, embeddingSupport: 0, embeddingOnly: 0, entityType: "hook" },
        characters: { total: 0, rule: 0, embeddingSupport: 0, embeddingOnly: 0, entityType: "character" },
        factions: { total: 0, rule: 0, embeddingSupport: 0, embeddingOnly: 0, entityType: "faction" },
        items: { total: 0, rule: 0, embeddingSupport: 0, embeddingOnly: 0, entityType: "item" },
        relations: { total: 0, rule: 0, embeddingSupport: 0, embeddingOnly: 0, entityType: "relation" },
        worldSettings: { total: 0, rule: 0, embeddingSupport: 0, embeddingOnly: 0, entityType: "world_setting" },
      },
      recentChaptersScanned: 4,
      recentChaptersKept: 2,
      outlinesKept: 1,
    },
    retention: {
      hardConstraintPromotionCounts: {
        hooks: { promoted: 0, leftAsSoft: 0 },
        characters: { promoted: 0, leftAsSoft: 0 },
        factions: { promoted: 0, leftAsSoft: 0 },
        items: { promoted: 0, leftAsSoft: 0 },
        relations: { promoted: 0, leftAsSoft: 0 },
        worldSettings: { promoted: 0, leftAsSoft: 0 },
      },
      priorityBucketCounts: {
        blockingConstraints: 1,
        decisionContext: 1,
        supportingContext: 0,
        backgroundNoise: 0,
      },
    },
    persistedSidecarSelection: {
      facts: [
        {
          id: 1,
          chapterNo: 18,
          chapterGap: 2,
          factType: "chapter_summary",
          factText: "近期事实",
          rank: 1,
          score: 88,
          selected: true,
          selectedBy: "top_k",
          longTailCandidate: false,
          droppedReason: null,
          surfacedIn: ["blockingConstraints"],
          trace: {
            score: 88,
            keywordMatched: true,
            structuralManualMatch: false,
            keywordScore: 20,
            riskScore: 20,
            importanceScore: 20,
            recencyScore: 20,
            structuralBoost: 8,
          },
        },
        {
          id: 2,
          chapterNo: 3,
          chapterGap: 17,
          factType: "chapter_summary",
          factText: "远章节事实",
          rank: 2,
          score: 70,
          selected: true,
          selectedBy: "long_tail_reserve",
          longTailCandidate: true,
          droppedReason: null,
          surfacedIn: ["recentChanges"],
          trace: {
            score: 70,
            keywordMatched: true,
            structuralManualMatch: false,
            keywordScore: 18,
            riskScore: 20,
            importanceScore: 14,
            recencyScore: 10,
            structuralBoost: 8,
          },
        },
      ],
      events: [
        {
          id: 3,
          chapterNo: 4,
          chapterGap: 16,
          title: "远章节事件",
          unresolvedImpact: "仍未收束",
          rank: 1,
          score: 75,
          selected: true,
          selectedBy: "long_tail_reserve",
          longTailCandidate: true,
          droppedReason: null,
          surfacedIn: ["riskReminders"],
          trace: {
            score: 75,
            keywordMatched: true,
            structuralManualMatch: false,
            keywordScore: 20,
            unresolvedScore: 18,
            recencyScore: 12,
            structuralBoost: 25,
          },
        },
      ],
    },
    candidates: {
      hooks: [],
      characters: [],
      factions: [],
      items: [],
      relations: [],
      worldSettings: [],
    },
    hardConstraints: {
      hooks: [],
      characters: [],
      factions: [],
      items: [],
      relations: [],
      worldSettings: [],
    },
    priorityContext: {
      blockingConstraints: [],
      decisionContext: [],
      supportingContext: [],
      backgroundNoise: [],
    },
    promptContext: {
      plan: {
        charBudget: 5200,
        sections: {
          mustFollowFacts: { inputCount: 2, outputCount: 1, lineLimitDropped: 1, budgetDropped: 0, clippedCount: 1 },
          recentChanges: { inputCount: 1, outputCount: 1, lineLimitDropped: 0, budgetDropped: 0, clippedCount: 0 },
          coreEntities: { inputCount: 0, outputCount: 0, lineLimitDropped: 0, budgetDropped: 0, clippedCount: 0 },
          requiredHooks: { inputCount: 0, outputCount: 0, lineLimitDropped: 0, budgetDropped: 0, clippedCount: 0 },
          forbiddenMoves: { inputCount: 1, outputCount: 1, lineLimitDropped: 0, budgetDropped: 0, clippedCount: 0 },
          supportingBackground: { inputCount: 1, outputCount: 0, lineLimitDropped: 0, budgetDropped: 1, clippedCount: 0 },
        },
        surfacedPersistedRefs: [
          { section: "mustFollowFacts", source: { sourceType: "persisted_fact", sourceId: 2 }, chapterGap: 17, selectedBy: "long_tail_reserve" },
          { section: "recentChanges", source: { sourceType: "persisted_event", sourceId: 3 }, chapterGap: 16, selectedBy: "long_tail_reserve" },
        ],
      },
    },
  };

  const summary = summarizeRetrievalObservability(observability);

  assert.equal(summary.persistedSidecarSelection.factsSelectedByTopK, 1);
  assert.equal(summary.persistedSidecarSelection.factsSelectedByLongTailReserve, 1);
  assert.equal(summary.persistedSidecarSelection.eventsSelectedByLongTailReserve, 1);
  assert.equal(summary.persistedSidecarSelection.factsLongTailCandidates, 1);
  assert.equal(summary.persistedSidecarSelection.eventsLongTailCandidates, 1);
  assert.equal(summary.promptContextPlan?.farChapterSurfacedPersistedRefCount, 2);
  assert.equal(summary.promptContextPlan?.surfacedPersistedRefCount, 2);
  assert.equal(summary.promptContextPlan?.farChapterSurfacedPersistedRefRatio, 1);
  assert.deepEqual(summary.promptContextPlan?.sectionLossTotals, {
    lineLimitDropped: 1,
    budgetDropped: 1,
    clippedCount: 1,
  });
});
