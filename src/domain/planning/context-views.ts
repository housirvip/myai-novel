import type {
  PlanRetrievedContext,
  PlanRetrievedContextEntityGroups,
  RetrievedPriorityContext,
  RetrievedRecentChange,
} from "./types.js";

export function buildDraftContextView(context: PlanRetrievedContext | unknown) {
  const normalized = normalizePlanRetrievedContext(context);
  return {
    book: normalized.book,
    hardConstraints: normalized.hardConstraints,
    priorityContext: normalized.priorityContext,
    recentChanges: normalized.recentChanges,
    recentChapters: normalized.recentChapters,
    riskReminders: normalized.riskReminders,
    supportingOutlines: normalized.softReferences.outlines,
  };
}

export function buildReviewContextView(context: PlanRetrievedContext | unknown) {
  const normalized = normalizePlanRetrievedContext(context);
  return {
    book: normalized.book,
    hardConstraints: normalized.hardConstraints,
    priorityContext: normalized.priorityContext,
    recentChanges: normalized.recentChanges,
    recentChapters: normalized.recentChapters,
    riskReminders: normalized.riskReminders,
  };
}

export function buildRepairContextView(context: PlanRetrievedContext | unknown) {
  const normalized = normalizePlanRetrievedContext(context);
  return {
    book: normalized.book,
    hardConstraints: normalized.hardConstraints,
    priorityContext: normalized.priorityContext,
    recentChanges: normalized.recentChanges,
    recentChapters: normalized.recentChapters,
    riskReminders: normalized.riskReminders,
    supportingOutlines: normalized.softReferences.outlines,
  };
}

export function buildApproveContextView(context: PlanRetrievedContext | unknown) {
  const normalized = normalizePlanRetrievedContext(context);
  return {
    book: normalized.book,
    hardConstraints: normalized.hardConstraints,
    priorityContext: normalized.priorityContext,
    recentChanges: normalized.recentChanges,
    recentChapters: normalized.recentChapters,
    riskReminders: normalized.riskReminders,
    supportingOutlines: normalized.softReferences.outlines,
  };
}

export function buildApproveDiffContextView(context: PlanRetrievedContext | unknown) {
  const normalized = normalizePlanRetrievedContext(context);
  return {
    book: normalized.book,
    hardConstraints: normalized.hardConstraints,
    priorityContext: normalized.priorityContext,
    recentChanges: normalized.recentChanges,
    recentChapters: normalized.recentChapters,
    riskReminders: normalized.riskReminders,
  };
}

function normalizePlanRetrievedContext(context: unknown): PlanRetrievedContext {
  const value = (context ?? {}) as Partial<PlanRetrievedContext> & {
    hardConstraints?: Partial<PlanRetrievedContextEntityGroups>;
    softReferences?: {
      outlines?: PlanRetrievedContext["outlines"];
      recentChapters?: PlanRetrievedContext["recentChapters"];
      entities?: Partial<PlanRetrievedContextEntityGroups>;
    };
    priorityContext?: RetrievedPriorityContext;
    recentChanges?: RetrievedRecentChange[];
  };

  const fallbackGroups = {
    hooks: value.hooks ?? [],
    characters: value.characters ?? [],
    factions: value.factions ?? [],
    items: value.items ?? [],
    relations: value.relations ?? [],
    worldSettings: value.worldSettings ?? [],
  } satisfies PlanRetrievedContextEntityGroups;

  return {
    book: value.book ?? {
      id: 0,
      title: "",
      summary: null,
      targetChapterCount: null,
      currentChapterCount: 0,
    },
    outlines: value.outlines ?? [],
    recentChapters: value.recentChapters ?? [],
    hooks: value.hooks ?? fallbackGroups.hooks,
    characters: value.characters ?? fallbackGroups.characters,
    factions: value.factions ?? fallbackGroups.factions,
    items: value.items ?? fallbackGroups.items,
    relations: value.relations ?? fallbackGroups.relations,
    worldSettings: value.worldSettings ?? fallbackGroups.worldSettings,
    hardConstraints: {
      hooks: value.hardConstraints?.hooks ?? fallbackGroups.hooks,
      characters: value.hardConstraints?.characters ?? fallbackGroups.characters,
      factions: value.hardConstraints?.factions ?? fallbackGroups.factions,
      items: value.hardConstraints?.items ?? fallbackGroups.items,
      relations: value.hardConstraints?.relations ?? fallbackGroups.relations,
      worldSettings: value.hardConstraints?.worldSettings ?? fallbackGroups.worldSettings,
    },
    softReferences: {
      outlines: value.softReferences?.outlines ?? value.outlines ?? [],
      recentChapters: value.softReferences?.recentChapters ?? value.recentChapters ?? [],
      entities: {
        hooks: value.softReferences?.entities?.hooks ?? fallbackGroups.hooks,
        characters: value.softReferences?.entities?.characters ?? fallbackGroups.characters,
        factions: value.softReferences?.entities?.factions ?? fallbackGroups.factions,
        items: value.softReferences?.entities?.items ?? fallbackGroups.items,
        relations: value.softReferences?.entities?.relations ?? fallbackGroups.relations,
        worldSettings: value.softReferences?.entities?.worldSettings ?? fallbackGroups.worldSettings,
      },
    },
    riskReminders: value.riskReminders ?? [],
    priorityContext: value.priorityContext,
    recentChanges: value.recentChanges ?? [],
  };
}
