import type { ChapterPlanRow } from "../../core/db/repositories/chapter-plan-repository.js";
import type { ChapterRow } from "../../core/db/repositories/chapter-repository.js";
import type { PlanIntentConstraints } from "../planning/types.js";

export function parseStoredJson(value: string | null): unknown {
  if (!value) {
    return undefined;
  }

  try {
    return JSON.parse(value);
  } catch {
    // 历史数据或异常写入不应直接让后续工作流在解析阶段崩溃；
    // 对调用方来说，无法解析时按“无可用结构化上下文”处理更安全。
    return undefined;
  }
}

export function appendChapterNote(
  existing: string | null,
  chapterNo: number,
  note: string | null | undefined,
): string | null {
  const normalized = note?.trim();

  if (!normalized) {
    return existing;
  }

  const prefix = `[Chapter ${chapterNo}] ${normalized}`;

  if (!existing?.trim()) {
    return prefix;
  }

  return `${existing}\n${prefix}`;
}

export function dedupeNumberList(values: number[]): number[] {
  return [...new Set(values)];
}

export function parseStoredStringArray(value: string | null): string[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export function readPlanIntentConstraints(plan: ChapterPlanRow): PlanIntentConstraints {
  return {
    intentSummary: plan.intent_summary,
    mustInclude: parseStoredStringArray(plan.intent_must_include),
    mustAvoid: parseStoredStringArray(plan.intent_must_avoid),
  };
}

export function assertChapterPointersUnchanged(
  chapter: ChapterRow,
  expected: {
    currentPlanId?: number | null;
    currentDraftId?: number | null;
    currentReviewId?: number | null;
  },
): void {
  // 模型生成和事务提交之间存在时间窗口；
  // 如果章节 current_* pointer 在这段时间里被别的操作切换，就必须中止提交，避免把新版本叠在旧上下文上。
  if (
    expected.currentPlanId !== undefined &&
    chapter.current_plan_id !== expected.currentPlanId
  ) {
    throw new Error("Current plan pointer changed before commit");
  }

  if (
    expected.currentDraftId !== undefined &&
    chapter.current_draft_id !== expected.currentDraftId
  ) {
    throw new Error("Current draft pointer changed before commit");
  }

  if (
    expected.currentReviewId !== undefined &&
    chapter.current_review_id !== expected.currentReviewId
  ) {
    throw new Error("Current review pointer changed before commit");
  }
}
