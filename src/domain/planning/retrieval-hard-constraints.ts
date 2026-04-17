import type { PlanRetrievedContextEntityGroups, RetrievedEntity } from "./types.js";

export function buildHardConstraints(groups: PlanRetrievedContextEntityGroups): PlanRetrievedContextEntityGroups {
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

function selectCharacterHardConstraints(entities: RetrievedEntity[]): RetrievedEntity[] {
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
