import type { RetrievedFactPacket, RetrievedRecentChange, RetrievedRiskReminder } from "./types.js";

export type PersistedSourceRef = {
  sourceType: "persisted_fact" | "persisted_event";
  sourceId: number;
};

export function mergePersistedSourceRefs(input: {
  primary?: PersistedSourceRef;
  refs?: PersistedSourceRef[];
}): PersistedSourceRef[] {
  const combined = [
    ...(input.refs ?? []),
    ...(input.primary ? [input.primary] : []),
  ];

  const seen = new Set<string>();
  const result: PersistedSourceRef[] = [];

  for (const source of combined) {
    const key = `${source.sourceType}:${source.sourceId}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(source);
  }

  return result;
}

export function createPersistedFactRef(sourceId: number): PersistedSourceRef {
  return {
    sourceType: "persisted_fact",
    sourceId,
  };
}

export function createPersistedEventRef(sourceId: number): PersistedSourceRef {
  return {
    sourceType: "persisted_event",
    sourceId,
  };
}

export function createRiskReminderWithProvenance(input: {
  text: string;
  sourceRef?: PersistedSourceRef;
  sourceRefs?: PersistedSourceRef[];
}): RetrievedRiskReminder {
  return normalizeRiskReminderProvenance({
    text: input.text,
    sourceRef: input.sourceRef,
    sourceRefs: input.sourceRefs,
  });
}

export function createRecentChangeWithProvenance(input: RetrievedRecentChange): RetrievedRecentChange {
  return normalizeRecentChangeProvenance(input);
}

export function createFactPacketWithProvenance(input: RetrievedFactPacket): RetrievedFactPacket {
  return normalizeFactPacketProvenance(input);
}

export function normalizeRiskReminderProvenance(reminder: string | RetrievedRiskReminder): RetrievedRiskReminder {
  if (typeof reminder === "string") {
    return { text: reminder };
  }

  const sourceRefs = mergePersistedSourceRefs({
    primary: reminder.sourceRef,
    refs: reminder.sourceRefs,
  });

  return {
    ...reminder,
    sourceRef: reminder.sourceRef ?? sourceRefs[0],
    sourceRefs: sourceRefs.length > 0 ? sourceRefs : undefined,
  };
}

export function normalizeRecentChangeProvenance(change: RetrievedRecentChange): RetrievedRecentChange {
  const sourceRefs = mergePersistedSourceRefs({
    primary: change.sourceRef,
    refs: change.sourceRefs,
  });

  return {
    ...change,
    sourceRef: change.sourceRef ?? sourceRefs[0],
    sourceRefs: sourceRefs.length > 0 ? sourceRefs : undefined,
  };
}

export function normalizeFactPacketProvenance(packet: RetrievedFactPacket): RetrievedFactPacket {
  const sourceRefs = mergePersistedSourceRefs({
    primary: packet.sourceRef,
    refs: packet.sourceRefs,
  });

  return {
    ...packet,
    sourceRef: packet.sourceRef ?? sourceRefs[0],
    sourceRefs: sourceRefs.length > 0 ? sourceRefs : undefined,
  };
}

export function hasPersistedSourceRef(
  value: RetrievedRiskReminder | RetrievedRecentChange | RetrievedFactPacket,
  sourceType: PersistedSourceRef["sourceType"],
  sourceId: number,
): boolean {
  return mergePersistedSourceRefs({
    primary: value.sourceRef,
    refs: value.sourceRefs,
  }).some((source) => source.sourceType === sourceType && source.sourceId === sourceId);
}
