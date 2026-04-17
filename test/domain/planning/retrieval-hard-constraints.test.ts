import assert from "node:assert/strict";
import test from "node:test";

import { buildHardConstraints, explainHardConstraintSelection } from "../../../src/domain/planning/retrieval-hard-constraints.js";
import type { PlanRetrievedContextEntityGroups, RetrievedEntity } from "../../../src/domain/planning/types.js";

test("buildHardConstraints keeps priority entities while filling remaining slots by score order", () => {
  const groups = createGroups({
    characters: [
      createEntity({ id: 1, name: "林夜", reason: "keyword_hit", content: "current_location=青岳宗外门", score: 60 }),
      createEntity({ id: 2, name: "路人甲", reason: "low_relevance", content: "status=alive", score: 10 }),
    ],
    items: [
      createEntity({ id: 3, name: "黑铁令", reason: "keyword_hit", content: "owner_type=character\nstatus=active", score: 45 }),
      createEntity({ id: 4, name: "杂物", reason: "low_relevance", content: "status=active", score: 5 }),
    ],
  });

  const hardConstraints = buildHardConstraints(groups);

  assert.deepEqual(hardConstraints.characters.map((item) => item.id), [1, 2]);
  assert.deepEqual(hardConstraints.items.map((item) => item.id), [3, 4]);
});

test("buildHardConstraints keeps observer-style character constraints when continuity risk is present", () => {
  const hardConstraints = buildHardConstraints(createGroups({
    characters: [
      createEntity({
        id: 1,
        name: "顾沉舟",
        reason: "continuity_risk",
        content: "background=曾目睹同门背叛\ngoal=暗中观察黑铁令持有者",
        score: 30,
      }),
    ],
  }));

  assert.deepEqual(hardConstraints.characters.map((item) => item.id), [1]);
});

test("buildHardConstraints keeps keyword-hit relations and institution-context world settings", () => {
  const hardConstraints = buildHardConstraints(createGroups({
    relations: [
      createEntity({ id: 1, reason: "keyword_hit", content: "relation_type=member", score: 30 }),
    ],
    worldSettings: [
      createEntity({ id: 2, title: "宗门制度", reason: "institution_context", content: "category=规则", score: 18 }),
    ],
  }));

  assert.deepEqual(hardConstraints.relations.map((item) => item.id), [1]);
  assert.deepEqual(hardConstraints.worldSettings.map((item) => item.id), [2]);
});

test("explainHardConstraintSelection exposes why selected entities stayed in hard constraints", () => {
  assert.deepEqual(
    explainHardConstraintSelection(
      "character",
      createEntity({ id: 1, name: "林夜", reason: "keyword_hit", content: "current_location=青岳宗外门", score: 60 }),
    ),
    ["guaranteed_current_location"],
  );

  assert.deepEqual(
    explainHardConstraintSelection(
      "relation",
      createEntity({ id: 2, reason: "manual_entity_link+keyword_hit", content: "relation_type=member", score: 30 }),
    ),
    ["manual_entity_link", "keyword_hit_relation"],
  );
});

function createGroups(input: Partial<PlanRetrievedContextEntityGroups>): PlanRetrievedContextEntityGroups {
  return {
    hooks: input.hooks ?? [],
    characters: input.characters ?? [],
    factions: input.factions ?? [],
    items: input.items ?? [],
    relations: input.relations ?? [],
    worldSettings: input.worldSettings ?? [],
  };
}

function createEntity(input: Partial<RetrievedEntity> & { id: number }): RetrievedEntity {
  return {
    id: input.id,
    name: input.name,
    title: input.title,
    reason: input.reason ?? "low_relevance",
    content: input.content ?? "",
    score: input.score ?? 0,
  };
}
