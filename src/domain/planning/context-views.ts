import type {
  PlanRetrievedContext,
  PlanRetrievedContextEntityGroups,
  RetrievedPriorityContext,
  RetrievedRecentChange,
} from "./types.js";

export function buildDraftContextView(context: PlanRetrievedContext | unknown) {
  // draft 阶段需要“约束 + 少量支撑背景”，所以会额外带上 supportingOutlines，
  // 让模型既知道不能写错什么，也知道这一章在更长剧情里的承接位置。
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
  // review 更关注“正文是否违反已有事实”，因此这里故意给更轻的视图，
  // 避免过多软参考信息把审查任务稀释成再次创作。
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
  // approve diff 的目标是抽取事实变更，不是继续扩写正文，
  // 所以这里去掉 supportingOutlines，尽量把模型注意力锁在已知事实边界和最近变化上。
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
  // 这里承担 retrieved_context 的兼容层职责：
  // 无论数据库里存的是旧扁平结构，还是新分层结构，都统一整理成当前 workflow 可消费的形状。
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
      // 老版本 payload 没有 hardConstraints 时，退回到旧的平铺实体列表。
      // 这样老数据仍能继续跑 draft/review/approve，而不是因为字段升级直接失效。
      hooks: value.hardConstraints?.hooks ?? fallbackGroups.hooks,
      characters: value.hardConstraints?.characters ?? fallbackGroups.characters,
      factions: value.hardConstraints?.factions ?? fallbackGroups.factions,
      items: value.hardConstraints?.items ?? fallbackGroups.items,
      relations: value.hardConstraints?.relations ?? fallbackGroups.relations,
      worldSettings: value.hardConstraints?.worldSettings ?? fallbackGroups.worldSettings,
    },
    softReferences: {
      // softReferences 同样允许从旧字段回填，保证“读取旧数据 + 写出新视图”这条链路平滑过渡。
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
