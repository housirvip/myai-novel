import fs from "node:fs/promises";
import path from "node:path";

import type { PlanRetrievedContext } from "../../src/domain/planning/types.js";

export interface RetrievalBenchmarkFixture {
  name: string;
  query: {
    keywords: string[];
  };
  expectationMode?: "strict" | "baseline_gap";
  expected: {
    blockingNames: string[];
    decisionNames?: string[];
    maxNoiseRatio?: number;
  };
}

export const RETRIEVAL_BENCHMARK_FIXTURE_NAMES = [
  "continuity-baseline",
  "character-motivation",
  "hook-payoff",
  "world-rule",
  "relation-shift",
  "authority-reaction",
  "item-drift",
  "location-drift",
] as const;

export interface RetrievalBenchmarkResult {
  fixtureName: string;
  blockingRecall: number;
  decisionRecall: number;
  noiseRatio: number;
}

export async function loadRetrievalBenchmarkFixture(name: string): Promise<RetrievalBenchmarkFixture> {
  const fixturePath = path.resolve("test/fixtures/retrieval-benchmark", `${name}.json`);
  const content = await fs.readFile(fixturePath, "utf8");
  return JSON.parse(content) as RetrievalBenchmarkFixture;
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

  return {
    fixtureName: fixture.name,
    blockingRecall,
    decisionRecall,
    noiseRatio,
  };
}

function ratio(hit: number, total: number): number {
  if (total <= 0) {
    return 1;
  }

  return hit / total;
}
