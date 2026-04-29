import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

import { buildPromptContextBlocksObserved } from "../../src/domain/planning/prompt-context-blocks.js";
import type { PlanRetrievedContext } from "../../src/domain/planning/types.js";

const FAR_CHAPTER_GAP = 8;

export type RetrievalBenchmarkExpectationMode = "strict" | "baseline_gap";

export type RetrievalBenchmarkGroup = "core" | "longform";

export interface RetrievalBenchmarkFixture {
  name: string;
  query: {
    chapterNo?: number;
    keywords: string[];
  };
  expectationMode?: RetrievalBenchmarkExpectationMode;
  expected: {
    blockingNames: string[];
    decisionNames?: string[];
    maxNoiseRatio?: number;
  };
}

export const LONGFORM_RETRIEVAL_BENCHMARK_FIXTURE_NAMES = [
  "long-distance-callback",
  "long-distance-motivation",
  "long-distance-world-rule",
  "dense-entity-ambiguity",
] as const;

export const RETRIEVAL_BENCHMARK_FIXTURE_NAMES = [
  "continuity-baseline",
  "character-motivation",
  "cross-entity-conflict",
  "executor-identity",
  "institution-decision-immutability",
  "mixed-constraint",
  "motivation-immutability",
  "hook-payoff",
  "world-rule",
  "relation-shift",
  "authority-reaction",
  "item-drift",
  "location-drift",
  "source-observation",
  "source-immutability",
  "observer-immutability",
  "long-distance-callback",
  "long-distance-motivation",
  "long-distance-world-rule",
  "dense-entity-ambiguity",
] as const;

const LONGFORM_RETRIEVAL_BENCHMARK_FIXTURE_NAME_SET = new Set<string>(LONGFORM_RETRIEVAL_BENCHMARK_FIXTURE_NAMES);

const RETRIEVAL_BENCHMARK_GROUP_BOOK_IDS: Record<RetrievalBenchmarkGroup, number> = {
  core: 1,
  longform: 2,
};

export interface RetrievalBenchmarkResult {
  fixtureName: string;
  group: RetrievalBenchmarkGroup;
  expectationMode: RetrievalBenchmarkExpectationMode;
  blockingRecall: number;
  decisionRecall: number;
  noiseRatio: number;
  observability: {
    candidateSourceCounts: {
      rule: number;
      embeddingSupport: number;
      embeddingOnly: number;
    };
    hardConstraintExplainedRatio: number;
    priorityAssignmentExplainedRatio: number;
    promptContext: {
      surfacedPersistedRefCount: number;
      farChapterSurfacedPersistedRefCount: number;
      farChapterSurfacedPersistedRefRatio: number;
      factsSelectedByLongTailReserve: number;
      eventsSelectedByLongTailReserve: number;
      sectionLossTotals: {
        lineLimitDropped: number;
        budgetDropped: number;
        clippedCount: number;
      };
    };
  };
}

export interface RetrievalBenchmarkGroupSummary {
  group: RetrievalBenchmarkGroup;
  fixtureCount: number;
  strictCount: number;
  baselineGapCount: number;
  averageBlockingRecall: number;
  averageDecisionRecall: number;
  averageNoiseRatio: number;
  averageHardConstraintExplainedRatio: number;
  averagePriorityAssignmentExplainedRatio: number;
  averageFarChapterSurfacedPersistedRefRatio: number;
  averageFactsSelectedByLongTailReserve: number;
  averageEventsSelectedByLongTailReserve: number;
}

export async function loadRetrievalBenchmarkFixture(name: string): Promise<RetrievalBenchmarkFixture> {
  const fixturePath = path.resolve("test/fixtures/retrieval-benchmark", `${name}.json`);
  const content = await fs.readFile(fixturePath, "utf8");
  return JSON.parse(content) as RetrievalBenchmarkFixture;
}

export function getRetrievalBenchmarkFixtureGroup(fixtureName: string): RetrievalBenchmarkGroup {
  return LONGFORM_RETRIEVAL_BENCHMARK_FIXTURE_NAME_SET.has(fixtureName) ? "longform" : "core";
}

export function getRetrievalBenchmarkFixtureBookId(fixtureName: string): number {
  return RETRIEVAL_BENCHMARK_GROUP_BOOK_IDS[getRetrievalBenchmarkFixtureGroup(fixtureName)];
}

export function normalizeRetrievalBenchmarkExpectationMode(
  expectationMode?: RetrievalBenchmarkExpectationMode,
): RetrievalBenchmarkExpectationMode {
  return expectationMode ?? "strict";
}

export function evaluateRetrievalBenchmark(
  fixture: RetrievalBenchmarkFixture,
  context: PlanRetrievedContext,
): RetrievalBenchmarkResult {
  const blockingActual = new Set((context.priorityContext?.blockingConstraints ?? []).map((item) => item.displayName));
  const decisionActual = new Set((context.priorityContext?.decisionContext ?? []).map((item) => item.displayName));

  const blockingRecall = ratio(
    fixture.expected.blockingNames.filter((name) => blockingActual.has(name)).length,
    fixture.expected.blockingNames.length,
  );
  const decisionExpected = fixture.expected.decisionNames ?? [];
  const decisionRecall = decisionExpected.length === 0
    ? 1
    : ratio(
        decisionExpected.filter((name) => decisionActual.has(name)).length,
        decisionExpected.length,
      );

  const decisionPackets = context.priorityContext?.decisionContext ?? [];
  const relevantNames = new Set([...fixture.expected.blockingNames, ...decisionExpected]);
  const noiseCount = decisionPackets.filter((packet) => !relevantNames.has(packet.displayName)).length;
  const noiseRatio = decisionPackets.length === 0 ? 0 : ratio(noiseCount, decisionPackets.length);
  const candidateObservations = context.retrievalObservability
    ? Object.values(context.retrievalObservability.candidates).flat()
    : [];
  const hardConstraintObservations = context.retrievalObservability
    ? Object.values(context.retrievalObservability.hardConstraints).flat()
    : [];
  const priorityObservations = context.retrievalObservability
    ? Object.values(context.retrievalObservability.priorityContext).flat()
    : [];
  const promptContextObserved = context.retrievalObservability?.promptContext?.plan
    ?? buildPromptContextBlocksObserved(context, { mode: "plan" }).observability;
  const factsSelectedByLongTailReserve = (context.retrievalObservability?.persistedSidecarSelection.facts ?? [])
    .filter((item) => item.selectedBy === "long_tail_reserve").length;
  const eventsSelectedByLongTailReserve = (context.retrievalObservability?.persistedSidecarSelection.events ?? [])
    .filter((item) => item.selectedBy === "long_tail_reserve").length;
  const farChapterSurfacedPersistedRefCount = promptContextObserved.surfacedPersistedRefs.filter((item) =>
    typeof item.chapterGap === "number" && item.chapterGap >= FAR_CHAPTER_GAP
  ).length;
  const expectationMode = normalizeRetrievalBenchmarkExpectationMode(fixture.expectationMode);

  return {
    fixtureName: fixture.name,
    group: getRetrievalBenchmarkFixtureGroup(fixture.name),
    expectationMode,
    blockingRecall,
    decisionRecall,
    noiseRatio,
    observability: {
      candidateSourceCounts: {
        rule: candidateObservations.filter((item) => item.source === "rule").length,
        embeddingSupport: candidateObservations.filter((item) => item.source === "embedding_support").length,
        embeddingOnly: candidateObservations.filter((item) => item.source === "embedding_only").length,
      },
      hardConstraintExplainedRatio: ratio(
        hardConstraintObservations.filter((item) => item.selectedBy.length > 0).length,
        hardConstraintObservations.length,
      ),
      priorityAssignmentExplainedRatio: ratio(
        priorityObservations.filter((item) => item.assignedBy.length > 0).length,
        priorityObservations.length,
      ),
      promptContext: {
        surfacedPersistedRefCount: promptContextObserved.surfacedPersistedRefs.length,
        farChapterSurfacedPersistedRefCount,
        farChapterSurfacedPersistedRefRatio: ratio(
          farChapterSurfacedPersistedRefCount,
          promptContextObserved.surfacedPersistedRefs.length,
        ),
        factsSelectedByLongTailReserve,
        eventsSelectedByLongTailReserve,
        sectionLossTotals: Object.values(promptContextObserved.sections).reduce(
          (totals, section) => ({
            lineLimitDropped: totals.lineLimitDropped + section.lineLimitDropped,
            budgetDropped: totals.budgetDropped + section.budgetDropped,
            clippedCount: totals.clippedCount + section.clippedCount,
          }),
          { lineLimitDropped: 0, budgetDropped: 0, clippedCount: 0 },
        ),
      },
    },
  };
}

export function assertRetrievalBenchmarkExpectation(
  fixture: RetrievalBenchmarkFixture,
  result: RetrievalBenchmarkResult,
): void {
  assert.equal(result.fixtureName, fixture.name);
  assert.equal(result.group, getRetrievalBenchmarkFixtureGroup(fixture.name));
  assert.equal(result.expectationMode, normalizeRetrievalBenchmarkExpectationMode(fixture.expectationMode));

  if (result.expectationMode === "baseline_gap") {
    assert.ok(
      result.blockingRecall < 1
        || result.decisionRecall < 1
        || result.noiseRatio > (fixture.expected.maxNoiseRatio ?? 1),
      `${fixture.name} should currently expose a retrieval gap`,
    );
    return;
  }

  assert.equal(result.blockingRecall, 1, `${fixture.name} blocking recall should stay at 1`);
  assert.ok(result.decisionRecall >= 0.5, `${fixture.name} decision recall should stay usable`);
  assert.ok(result.noiseRatio <= (fixture.expected.maxNoiseRatio ?? 1), `${fixture.name} noise ratio too high`);
  assert.equal(
    result.observability.hardConstraintExplainedRatio,
    1,
    `${fixture.name} hard constraints should stay explained`,
  );
  assert.equal(
    result.observability.priorityAssignmentExplainedRatio,
    1,
    `${fixture.name} priority packets should stay explained`,
  );
}

export function summarizeRetrievalBenchmarkGroup(
  results: readonly RetrievalBenchmarkResult[],
  group: RetrievalBenchmarkGroup,
): RetrievalBenchmarkGroupSummary {
  const groupResults = results.filter((result) => result.group === group);

  return {
    group,
    fixtureCount: groupResults.length,
    strictCount: groupResults.filter((result) => result.expectationMode === "strict").length,
    baselineGapCount: groupResults.filter((result) => result.expectationMode === "baseline_gap").length,
    averageBlockingRecall: average(groupResults.map((result) => result.blockingRecall)),
    averageDecisionRecall: average(groupResults.map((result) => result.decisionRecall)),
    averageNoiseRatio: average(groupResults.map((result) => result.noiseRatio)),
    averageHardConstraintExplainedRatio: average(
      groupResults.map((result) => result.observability.hardConstraintExplainedRatio),
    ),
    averagePriorityAssignmentExplainedRatio: average(
      groupResults.map((result) => result.observability.priorityAssignmentExplainedRatio),
    ),
    averageFarChapterSurfacedPersistedRefRatio: average(
      groupResults.map((result) => result.observability.promptContext.farChapterSurfacedPersistedRefRatio),
    ),
    averageFactsSelectedByLongTailReserve: average(
      groupResults.map((result) => result.observability.promptContext.factsSelectedByLongTailReserve),
    ),
    averageEventsSelectedByLongTailReserve: average(
      groupResults.map((result) => result.observability.promptContext.eventsSelectedByLongTailReserve),
    ),
  };
}

function ratio(hit: number, total: number): number {
  if (total <= 0) {
    return 1;
  }

  return hit / total;
}

function average(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
