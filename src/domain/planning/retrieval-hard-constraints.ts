import type { PlanRetrievedContextEntityGroups, RetrievedEntity } from "./types.js";

export function buildHardConstraints(groups: PlanRetrievedContextEntityGroups): PlanRetrievedContextEntityGroups {
  return {
    hooks: selectPriorityEntities(groups.hooks, 5, (entity) =>
      entity.reason.includes("chapter_proximity") || entity.reason.includes("manual_id"),
    ),
    // 人物如果是手工指定、关键词强命中，或文本里带当前位置/状态信息，优先进入硬约束。
    // 另外保留少量带 continuity_risk 且具备目标/背景状态的人物，用于承接“不可改写观察者/动机”这类约束查询。
    characters: selectPriorityEntities(groups.characters, 6, (entity) =>
      entity.reason.includes("manual_id") ||
      (entity.reason.includes("keyword_hit") && entity.content.includes("current_location=")) ||
      (entity.reason.includes("continuity_risk") && entity.content.includes("current_location=")) ||
      (entity.reason.includes("continuity_risk")
        && (entity.content.includes("goal=") || entity.content.includes("background="))) ||
      entity.score >= 130,
    ),
    factions: selectPriorityEntities(groups.factions, 4, (entity) =>
      entity.reason.includes("manual_id") || entity.score >= 125,
    ),
    // 物品归属和状态最容易造成连续性错误，因此优先保留带 owner/status 信息的高分项。
    items: selectPriorityEntities(groups.items, 4, (entity) =>
      entity.reason.includes("manual_id") ||
      ((entity.reason.includes("keyword_hit") || entity.reason.includes("continuity_risk"))
        && (entity.content.includes("owner_type=") || entity.content.includes("status="))) ||
      entity.score >= 125,
    ),
    relations: selectPriorityEntities(groups.relations, 6, (entity) =>
      entity.reason.includes("manual_id") ||
      entity.reason.includes("manual_entity_link") ||
      entity.reason.includes("keyword_hit") ||
      entity.score >= 130,
    ),
    // 世界规则类内容即使不是最高分，只要是活跃规则也值得优先保留在硬约束层。
    worldSettings: selectPriorityEntities(groups.worldSettings, 4, (entity) =>
      entity.reason.includes("manual_id") ||
      entity.reason.includes("keyword_hit") ||
      entity.reason.includes("institution_context") ||
      entity.score >= 125,
    ),
  };
}

function selectPriorityEntities(
  entities: RetrievedEntity[],
  limit: number,
  isPriority: (entity: RetrievedEntity) => boolean,
): RetrievedEntity[] {
  return entities.filter(isPriority).slice(0, limit);
}
