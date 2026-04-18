import type {
  PlanRetrievedContextEntityGroups,
  RetrievedPriorityContext,
} from "./types.js";
import { buildFactPacket, buildFactPacketsFromGroups } from "./fact-packet-builder.js";
import { dedupePackets, samePacket } from "./fact-packet-merge.js";
import { prioritizeFactPackets } from "./retrieval-priorities.js";
import { propagateRelationContext } from "./relation-propagation.js";

export { buildFactPacket, buildFactPacketsFromGroups };

export function buildPriorityContext(input: {
  hardConstraints?: Partial<PlanRetrievedContextEntityGroups>;
  softReferences?: Partial<PlanRetrievedContextEntityGroups>;
}): RetrievedPriorityContext {
  // priorityContext 的目标不是简单排序，而是把事实拆成 prompt 可消费的职责层级：
  // blockingConstraints 先保底，decisionContext 帮当前章节做判断，supporting/background 再负责补充语境。
  const hardPackets = buildFactPacketsFromGroups(input.hardConstraints ?? {});
  const softPackets = buildFactPacketsFromGroups(input.softReferences ?? {}).filter(
    (packet) => !hardPackets.some((blocking) => samePacket(blocking, packet)),
  );

  const prioritizedHard = prioritizeFactPackets(hardPackets);
  const prioritizedSoft = prioritizeFactPackets(softPackets);
  const propagatedFromRelations = propagateRelationContext({
    hardPackets,
    softPackets,
    prioritizedHard,
    prioritizedSoft,
  });

  return {
    // relation 传播出来的上下文会并入前两层，
    // 因为关系一旦被命中，关系两端实体往往也应提升到“需要一起看”的层级。
    blockingConstraints: dedupePackets([
      ...prioritizedHard.blockingConstraints,
      ...propagatedFromRelations.blockingConstraints,
    ]),
    decisionContext: dedupePackets([
      ...prioritizedHard.decisionContext,
      ...prioritizedSoft.blockingConstraints,
      ...prioritizedSoft.decisionContext,
      ...propagatedFromRelations.decisionContext,
    ]),
    supportingContext: [...prioritizedHard.supportingContext, ...prioritizedSoft.supportingContext],
    backgroundNoise: [...prioritizedHard.backgroundNoise, ...prioritizedSoft.backgroundNoise],
  };
}
