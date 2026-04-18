import type { PlanRetrievedContextEntityGroups, RetrievedEntity } from "./types.js";

import type { RetrievedFactEntityType } from "./types.js";

export function buildHardConstraints(groups: PlanRetrievedContextEntityGroups): PlanRetrievedContextEntityGroups {
  // hardConstraints 不是“得分最高的若干条”，而是“最容易写错且必须保底出现的事实子集”。
  // 因此这里会按实体类型分别走不同的兜底规则，而不是统一按 score 截断。
  return {
    hooks: selectPriorityEntities(groups.hooks, 5, (entity) =>
      entity.reason.includes("chapter_proximity") || entity.reason.includes("manual_id"),
    ),
    characters: selectCharacterHardConstraints(groups.characters),
    factions: selectPriorityEntities(groups.factions, 4, (entity) =>
      entity.reason.includes("manual_id") ||
      (entity.reason.includes("continuity_risk")
        && (entity.content.includes("core_goal=") || entity.content.includes("description=") || entity.content.includes("append_notes="))) ||
      entity.score >= 125,
    ),
    items: selectItemHardConstraints(groups.items),
    relations: selectRelationHardConstraints(groups.relations),
    worldSettings: selectWorldSettingHardConstraints(groups.worldSettings),
  };
}

export function explainHardConstraintSelection(entityType: RetrievedFactEntityType, entity: RetrievedEntity): string[] {
  const reasons = new Set<string>();

  if (entity.reason.includes("manual_id")) {
    reasons.add("manual_id");
  }

  switch (entityType) {
    case "hook":
      if (entity.reason.includes("chapter_proximity")) {
        reasons.add("chapter_proximity");
      }
      break;
    case "character":
      if (entity.score >= 130) {
        reasons.add("score_threshold");
      }
      if (entity.content.includes("current_location=")
        && (entity.reason.includes("keyword_hit") || entity.reason.includes("continuity_risk"))) {
        reasons.add("guaranteed_current_location");
      }
      if ((entity.content.includes("goal=") || entity.content.includes("background="))
        && (entity.reason.includes("keyword_hit") || entity.reason.includes("continuity_risk"))) {
        reasons.add("guaranteed_goal_or_background");
      }
      break;
    case "faction":
      if (entity.score >= 125) {
        reasons.add("score_threshold");
      }
      if (entity.reason.includes("continuity_risk")
        && (entity.content.includes("core_goal=") || entity.content.includes("description=") || entity.content.includes("append_notes="))) {
        reasons.add("continuity_goal_or_description");
      }
      break;
    case "item":
      if (entity.score >= 125) {
        reasons.add("score_threshold");
      }
      if ((entity.content.includes("owner_type=") || entity.content.includes("status="))
        && (entity.reason.includes("keyword_hit") || entity.reason.includes("continuity_risk") || entity.score >= 100)) {
        reasons.add("guaranteed_owner_or_status");
      }
      break;
    case "relation":
      if (entity.reason.includes("manual_entity_link")) {
        reasons.add("manual_entity_link");
      }
      if (entity.reason.includes("keyword_hit")) {
        reasons.add("keyword_hit_relation");
      }
      if (entity.score >= 130) {
        reasons.add("score_threshold");
      }
      break;
    case "world_setting":
      if (entity.score >= 125) {
        reasons.add("score_threshold");
      }
      if (entity.reason.includes("institution_context")
        || entity.reason.includes("keyword_hit")
        || entity.content.includes("规则")
        || entity.content.includes("制度")) {
        reasons.add("institution_or_rule_signal");
      }
      break;
    default:
      break;
  }

  if (reasons.size === 0) {
    reasons.add("fill_remaining_by_score");
  }

  return Array.from(reasons);
}

function selectCharacterHardConstraints(entities: RetrievedEntity[]): RetrievedEntity[] {
  // 人物最怕当前位置、目标、背景被写漂，
  // 所以除了高分实体，还会强行保留少量携带这些字段的候选，保证 prompt 至少看到一条关键状态。
  return fillRemainingByScore(
    dedupeById([
      ...entities.filter((entity) => entity.reason.includes("manual_id") || entity.score >= 130),
      ...selectGuaranteedEntities(entities, [
        {
          maxCount: 1,
          match: (entity) =>
            entity.content.includes("current_location=")
            && (entity.reason.includes("keyword_hit") || entity.reason.includes("continuity_risk")),
        },
        {
          maxCount: 1,
          match: (entity) =>
            (entity.content.includes("goal=") || entity.content.includes("background="))
            && (entity.reason.includes("keyword_hit") || entity.reason.includes("continuity_risk")),
        },
      ]),
    ]),
    entities,
    6,
  );
}

function selectItemHardConstraints(entities: RetrievedEntity[]): RetrievedEntity[] {
  // 物品连续性的核心通常是“谁持有、当前状态是什么”，
  // 因此 owner/status 命中的实体会比一般描述性条目更优先进入硬约束。
  return fillRemainingByScore(
    dedupeById([
      ...entities.filter((entity) => entity.reason.includes("manual_id") || entity.score >= 125),
      ...selectGuaranteedEntities(entities, [
        {
          maxCount: 1,
          match: (entity) =>
            (entity.content.includes("owner_type=") || entity.content.includes("status="))
            && (entity.reason.includes("keyword_hit") || entity.reason.includes("continuity_risk") || entity.score >= 100),
        },
      ]),
    ]),
    entities,
    4,
  );
}

function selectRelationHardConstraints(entities: RetrievedEntity[]): RetrievedEntity[] {
  // 关系实体优先保留手工点名、由手工实体牵引出的关系，以及正文意图直接命中的关系。
  // 这样可以降低 approve / draft 阶段把人物关系写断层的概率。
  return fillRemainingByScore(
    dedupeById([
      ...entities.filter((entity) => entity.reason.includes("manual_id") || entity.reason.includes("manual_entity_link")),
      ...selectGuaranteedEntities(entities, [
        {
          maxCount: 1,
          match: (entity) => entity.reason.includes("keyword_hit"),
        },
      ]),
      ...entities.filter((entity) => entity.score >= 130),
    ]),
    entities,
    6,
  );
}

function selectWorldSettingHardConstraints(entities: RetrievedEntity[]): RetrievedEntity[] {
  // 世界设定里最危险的是规则类、制度类约束被正文无意覆盖，
  // 所以 institution/rule 信号会被优先抬进硬约束，而不只是看普通相关性分数。
  return fillRemainingByScore(
    dedupeById([
      ...entities.filter((entity) => entity.reason.includes("manual_id") || entity.score >= 125),
      ...selectGuaranteedEntities(entities, [
        {
          maxCount: 1,
          match: (entity) =>
            entity.reason.includes("institution_context")
            || entity.reason.includes("keyword_hit")
            || entity.content.includes("规则")
            || entity.content.includes("制度"),
        },
      ]),
    ]),
    entities,
    4,
  );
}

function selectPriorityEntities(
  entities: RetrievedEntity[],
  limit: number,
  isPriority: (entity: RetrievedEntity) => boolean,
): RetrievedEntity[] {
  return entities.filter(isPriority).slice(0, limit);
}

function selectGuaranteedEntities(
  entities: RetrievedEntity[],
  buckets: Array<{
    maxCount: number;
    match: (entity: RetrievedEntity) => boolean;
  }>,
): RetrievedEntity[] {
  // bucket 按顺序消费，表示“每类关键事实至少保一条”。
  // 这里不是为了全面覆盖，而是为了避免某种关键状态在后续按分数截断时完全消失。
  const selected: RetrievedEntity[] = [];
  const usedIds = new Set<number>();

  for (const bucket of buckets) {
    let count = 0;

    for (const entity of entities) {
      if (usedIds.has(entity.id) || !bucket.match(entity)) {
        continue;
      }

      selected.push(entity);
      usedIds.add(entity.id);
      count += 1;

      if (count >= bucket.maxCount) {
        break;
      }
    }
  }

  return selected;
}

function fillRemainingByScore(
  selected: RetrievedEntity[],
  entities: RetrievedEntity[],
  limit: number,
): RetrievedEntity[] {
  // 先保规则性挑出来的实体，再用原始排序补满余量。
  // 这样最终集合既保留“不能丢的约束”，也保留一定的相关性顺序。
  const usedIds = new Set(selected.map((entity) => entity.id));
  const remaining = entities.filter((entity) => !usedIds.has(entity.id));
  return [...selected, ...remaining].slice(0, limit);
}

function dedupeById(entities: RetrievedEntity[]): RetrievedEntity[] {
  const map = new Map<number, RetrievedEntity>();

  for (const entity of entities) {
    if (!map.has(entity.id)) {
      map.set(entity.id, entity);
    }
  }

  return Array.from(map.values());
}
