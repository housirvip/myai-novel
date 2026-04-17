import type {
  PlanRetrievedContextEntityGroups,
  PlanRetrievalObservability,
  RetrievedEntity,
  RetrievedFactEntityType,
  RetrievedFactPacket,
  RetrievedPriorityContext,
  RetrievalCandidateSource,
  RetrievalObservedEntity,
  RetrievalObservedHardConstraint,
  RetrievalObservedPriorityPacket,
} from "./types.js";
import { explainHardConstraintSelection } from "./retrieval-hard-constraints.js";
import { classifyPriorityPacket } from "./retrieval-priorities.js";

const ENTITY_GROUP_TO_TYPE = {
  hooks: "hook",
  characters: "character",
  factions: "faction",
  items: "item",
  relations: "relation",
  worldSettings: "world_setting",
} as const satisfies Record<keyof PlanRetrievedContextEntityGroups, RetrievedFactEntityType>;

export function buildRetrievalObservability(input: {
  candidates: PlanRetrievedContextEntityGroups;
  hardConstraints: PlanRetrievedContextEntityGroups;
  priorityContext: RetrievedPriorityContext;
}): PlanRetrievalObservability {
  return {
    candidates: buildObservedEntityGroups(input.candidates),
    hardConstraints: buildObservedHardConstraintGroups(input.hardConstraints),
    priorityContext: buildObservedPriorityContext(input.priorityContext),
  };
}

export function summarizeRetrievalObservability(observability: PlanRetrievalObservability) {
  return {
    candidateCounts: summarizeObservedGroups(observability.candidates),
    hardConstraintCounts: summarizeObservedGroups(observability.hardConstraints),
    priorityBucketCounts: {
      blockingConstraints: observability.priorityContext.blockingConstraints.length,
      decisionContext: observability.priorityContext.decisionContext.length,
      supportingContext: observability.priorityContext.supportingContext.length,
      backgroundNoise: observability.priorityContext.backgroundNoise.length,
    },
  };
}

function buildObservedEntityGroups(groups: PlanRetrievedContextEntityGroups): Record<keyof PlanRetrievedContextEntityGroups, RetrievalObservedEntity[]> {
  return {
    hooks: groups.hooks.map((entity) => observeEntity("hook", entity)),
    characters: groups.characters.map((entity) => observeEntity("character", entity)),
    factions: groups.factions.map((entity) => observeEntity("faction", entity)),
    items: groups.items.map((entity) => observeEntity("item", entity)),
    relations: groups.relations.map((entity) => observeEntity("relation", entity)),
    worldSettings: groups.worldSettings.map((entity) => observeEntity("world_setting", entity)),
  };
}

function buildObservedHardConstraintGroups(groups: PlanRetrievedContextEntityGroups): Record<keyof PlanRetrievedContextEntityGroups, RetrievalObservedHardConstraint[]> {
  return {
    hooks: groups.hooks.map((entity) => observeHardConstraint("hook", entity)),
    characters: groups.characters.map((entity) => observeHardConstraint("character", entity)),
    factions: groups.factions.map((entity) => observeHardConstraint("faction", entity)),
    items: groups.items.map((entity) => observeHardConstraint("item", entity)),
    relations: groups.relations.map((entity) => observeHardConstraint("relation", entity)),
    worldSettings: groups.worldSettings.map((entity) => observeHardConstraint("world_setting", entity)),
  };
}

function buildObservedPriorityContext(priorityContext: RetrievedPriorityContext) {
  return {
    blockingConstraints: priorityContext.blockingConstraints.map((packet) => observePriorityPacket(packet)),
    decisionContext: priorityContext.decisionContext.map((packet) => observePriorityPacket(packet)),
    supportingContext: priorityContext.supportingContext.map((packet) => observePriorityPacket(packet)),
    backgroundNoise: priorityContext.backgroundNoise.map((packet) => observePriorityPacket(packet)),
  };
}

function observeEntity(entityType: RetrievedFactEntityType, entity: RetrievedEntity): RetrievalObservedEntity {
  return {
    entityType,
    entityId: entity.id,
    displayName: entity.name ?? entity.title ?? `#${entity.id}`,
    source: inferCandidateSource(entity.reason),
    reasons: splitReasons(entity.reason),
    score: entity.score,
  };
}

function observeHardConstraint(entityType: RetrievedFactEntityType, entity: RetrievedEntity): RetrievalObservedHardConstraint {
  return {
    ...observeEntity(entityType, entity),
    selectedBy: explainHardConstraintSelection(entityType, entity),
  };
}

function observePriorityPacket(packet: RetrievedFactPacket): RetrievalObservedPriorityPacket {
  const classification = classifyPriorityPacket(packet);
  return {
    entityType: packet.entityType,
    entityId: packet.entityId,
    displayName: packet.displayName,
    source: inferPacketSource(packet),
    reasons: packet.relevanceReasons,
    score: packet.scores.finalScore,
    bucket: classification.bucket,
    assignedBy: classification.assignedBy,
  };
}

function inferCandidateSource(reason: string): RetrievalCandidateSource {
  if (reason.includes("embedding_match")) {
    return "embedding_only";
  }
  if (reason.includes("embedding_support")) {
    return "embedding_support";
  }
  return "rule";
}

function inferPacketSource(packet: RetrievedFactPacket): RetrievalCandidateSource {
  return inferCandidateSource(packet.relevanceReasons.join("+"));
}

function splitReasons(reason: string): string[] {
  return reason.split("+").filter(Boolean);
}

function summarizeObservedGroups(groups: Record<keyof PlanRetrievedContextEntityGroups, Array<RetrievalObservedEntity | RetrievalObservedHardConstraint>>) {
  return Object.fromEntries(
    (Object.keys(groups) as Array<keyof PlanRetrievedContextEntityGroups>).map((groupName) => {
      const observations = groups[groupName];
      return [
        groupName,
        {
          total: observations.length,
          rule: observations.filter((item) => item.source === "rule").length,
          embeddingSupport: observations.filter((item) => item.source === "embedding_support").length,
          embeddingOnly: observations.filter((item) => item.source === "embedding_only").length,
          entityType: ENTITY_GROUP_TO_TYPE[groupName],
        },
      ];
    }),
  );
}
