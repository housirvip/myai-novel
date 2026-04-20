import type { PersistedRetrievalFact, PersistedStoryEvent, RetrievedChapterSummary, RetrievedEntity, RetrievedRecentChange, RetrievedRiskReminder } from "./types.js";

export function buildRecentChanges(input: {
  recentChapters?: RetrievedChapterSummary[];
  riskReminders?: RetrievedRiskReminder[];
  entities?: RetrievedEntity[];
  persistedFacts?: PersistedRetrievalFact[];
  persistedEvents?: PersistedStoryEvent[];
}): RetrievedRecentChange[] {
  // recentChanges 不是完整事件流，而是给 prompt 用的“近期最值得先看几条”。
  // 因此这里会把章节承接、风险提醒、状态型实体变化压到同一个小窗口里做排序。
  const chapterChanges = (input.recentChapters ?? []).slice(0, 6).map((chapter, index) => ({
    source: "chapter_summary" as const,
    label: `第${chapter.chapterNo}章承接`,
    detail: normalizeInline(chapter.summary) || chapter.title || "已发生关键承接",
    priority: 80 - index,
  }));

  const riskChanges = (input.riskReminders ?? []).slice(0, 4).map((risk, index) => ({
    source: "risk_reminder" as const,
    label: `高风险提醒${index + 1}`,
    detail: normalizeInline(risk.text),
    priority: 100 - index,
    sourceRef: risk.sourceRef,
  }));

  const entityChanges = (input.entities ?? [])
    .filter((entity) => hasStatefulChangeHint(entity.content))
    .slice(0, 4)
    .map((entity, index) => ({
      source: "entity_state" as const,
      label: entity.name ?? entity.title ?? `实体#${entity.id}`,
      detail: normalizeInline(entity.content),
      priority: 70 - index,
    }));

  const factChanges = (input.persistedFacts ?? []).slice(0, 4).map((fact, index) => ({
    source: "retrieval_fact" as const,
    label: fact.chapterNo ? `第${fact.chapterNo}章事实` : `历史事实${index + 1}`,
    detail: normalizeInline(fact.factText),
    priority: 85 - index,
    sourceRef: {
      sourceType: "persisted_fact" as const,
      sourceId: fact.id,
    },
  }));

  const eventChanges = (input.persistedEvents ?? []).slice(0, 3).map((event, index) => ({
    source: "story_event" as const,
    label: event.chapterNo ? `第${event.chapterNo}章事件` : event.title,
    detail: normalizeInline(event.unresolvedImpact || event.summary || event.title),
    priority: 78 - index,
    sourceRef: {
      sourceType: "persisted_event" as const,
      sourceId: event.id,
    },
  }));

  return [...riskChanges, ...factChanges, ...eventChanges, ...entityChanges, ...chapterChanges]
    .sort((left, right) => right.priority - left.priority)
    .slice(0, 8);
}

function hasStatefulChangeHint(content: string): boolean {
  // 这里只抓一小组高相关的状态字段线索。
  // 没有尝试覆盖所有实体属性，是为了让“最近变化”保持短而尖锐。
  const text = (content ?? "").toLowerCase();
  return ["current_location", "status", "owner", "relation", "target_chapter", "active"].some((token) =>
    text.includes(token),
  );
}

function normalizeInline(value?: string | null): string {
  return (value ?? "").replace(/\s+/g, " ").replace(/\n+/g, "；").trim();
}
