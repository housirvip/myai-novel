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
