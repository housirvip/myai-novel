import type { LlmMessage } from "../../core/llm/types.js";
import type { PlanIntentConstraints, PlanRetrievedContext } from "./types.js";
import { buildPromptContextBlocks } from "./prompt-context-blocks.js";

export function buildIntentGenerationPrompt(input: {
  bookTitle: string;
  chapterNo: number;
  outlinesText: string;
  recentChapterText: string;
  manualFocusText?: string;
}): LlmMessage[] {
  return [
    {
      role: "system",
      content:
        "你是一名长篇小说作者助手。请根据近期大纲和前文章节摘要，生成一段简洁但明确的本章作者意图草案。",
    },
    {
      role: "user",
      content: [
        `书名：${input.bookTitle}`,
        `章节号：第 ${input.chapterNo} 章`,
        "",
        "相关大纲：",
        input.outlinesText,
        "",
        "近期章节：",
        input.recentChapterText,
        input.manualFocusText?.trim()
          ? ["", "用户显式指定的重点实体：", input.manualFocusText].join("\n")
          : null,
        "",
        "请输出本章作者意图草案，聚焦本章要推进的主线、冲突和钩子。",
      ]
        .filter(Boolean)
        .join("\n"),
    },
  ];
}

export function buildKeywordExtractionPrompt(input: {
  authorIntent: string;
}): LlmMessage[] {
  return [
    {
      role: "system",
      content:
        "你是一名小说规划助手。请从作者意图中提取关键词，并返回 JSON：intentSummary, keywords, mustInclude, mustAvoid。keywords 中每个词不超过 8 个字。",
    },
    {
      role: "user",
      content: `作者意图：\n${input.authorIntent}`,
    },
  ];
}

export function buildPlanPrompt(input: {
  bookTitle: string;
  chapterNo: number;
  authorIntent: string;
  intentConstraints?: PlanIntentConstraints;
  retrievedContext: PlanRetrievedContext;
}): LlmMessage[] {
  const contextBlocks = buildPromptContextBlocks(input.retrievedContext);
  // plan prompt 的职责是把“本章想写什么”和“本章不能写错什么”同时交给模型。
  // 其中 retrievedContext 是后续所有阶段共享的事实边界，因此在 plan 阶段就必须显式固化。
  return [
    {
      role: "system",
      content:
        [
          "你是一名长篇网文策划助手。",
          "请基于作者意图、召回上下文和最近章节状态，输出可直接用于写作的章节规划。",
          "召回上下文中的 hardConstraints 默认都应视为有效约束。",
          "softReferences 用于补充背景，不应覆盖 hardConstraints。",
          "规划必须优先保证连续性、设定一致性、人物动机成立和钩子推进清晰。",
        ].join(""),
    },
    {
      role: "user",
      content: buildStructuredPrompt([
        section("章节信息", [
          `书名：${input.bookTitle}`,
          `章节号：第 ${input.chapterNo} 章`,
        ]),
        section("作者意图", input.authorIntent),
        buildIntentConstraintsSection(input.intentConstraints),
        ...buildReadableContextSections(contextBlocks),
        jsonSection(
          "召回上下文（必须严格参考）",
          buildCompactRetrievedContextForPrompt({
            retrievedContext: input.retrievedContext,
            mode: "plan",
          }),
        ),
        section("输出要求", [
          "请输出章节规划。",
          "至少包含：本章目标、主线、支线、出场角色、出场势力、关键道具、钩子推进、节奏分段、风险提醒。",
          "如果 hardConstraints、riskReminders 中存在明确限制，规划中必须显式承接。",
          "如果存在必须包含或必须避免的意图约束，规划中必须显式满足。",
        ]),
      ]),
    },
  ];
}

export function buildDraftPrompt(input: {
  planContent: string;
  intentConstraints?: PlanIntentConstraints;
  retrievedContext?: unknown;
  targetWords?: number;
}): LlmMessage[] {
  const contextBlocks = input.retrievedContext ? buildPromptContextBlocks(input.retrievedContext) : null;
  return [
    {
      role: "system",
      content:
        [
          "你是一名长篇网络小说写作助手。",
          "请根据章节规划创作完整、自然、连贯的章节草稿。",
          "召回上下文中的 hardConstraints 默认都应视为硬约束。",
          "recentChapters、supportingOutlines 和 riskReminders 用于帮助承接上下文，但不能推翻 hardConstraints。",
          "如果章节规划与召回上下文有细微冲突，优先保证设定一致和前后连续，再在正文里自然化处理。",
          "不要为了推进剧情而随意改写人物性格、能力边界、世界规则、货币体系、战力体系。",
          "若必须引入新信息，请保持克制，并避免与已召回设定直接冲突。",
          "输出时只给正文，不要附解释、标题清单或额外说明。",
        ].join(""),
    },
    {
      role: "user",
      content: buildStructuredPrompt([
        section("章节规划", input.planContent),
        buildIntentConstraintsSection(input.intentConstraints),
        ...buildReadableContextSections(contextBlocks),
        input.retrievedContext ? section("召回上下文（必须严格参考）", "以上事实块为本阶段的主要写作约束。") : null,
        input.targetWords ? section("目标字数", String(input.targetWords)) : null,
        section("写作要求", [
          "1. 必须覆盖章节规划中的主线推进、支线推进和钩子推进。",
          "2. 人物行为要符合已召回的人设、目标、位置、能力和关系。",
          "3. 世界设定、势力状态、物品状态、关系状态不能自相矛盾。",
          "4. 节奏上要像小说正文，不要写成大纲复述。",
          "5. 如果上下文里有风险提醒，正文中要主动规避对应问题。",
          "6. 如果存在必须包含或必须避免的意图约束，正文必须遵守。",
          "7. 只输出完整章节草稿正文。",
        ]),
      ]),
    },
  ];
}

export function buildReviewPrompt(input: {
  planContent: string;
  draftContent: string;
  retrievedContext?: unknown;
}): LlmMessage[] {
  const contextBlocks = input.retrievedContext ? buildPromptContextBlocks(input.retrievedContext) : null;
  // review 的输出会直接进入结构化落库和后续 repair，
  // 因此这里要把输出字段约束得足够稳定，避免下游解析依赖自然语言猜测。
  return [
    {
      role: "system",
      content:
        [
          "你是一名长篇小说审校助手。",
          "请检查草稿在设定一致性、人物行为、节奏、逻辑链路、关系演变和钩子推进上的问题。",
          "召回上下文中的 hardConstraints 和 recentChapters 默认都应视为核对基准。",
          "riskReminders 用于提醒你优先关注连续性高风险项。",
          "输出应聚焦真正影响正文质量和连续性的关键问题，不要泛泛而谈。",
        ].join(""),
    },
    {
      role: "user",
      content: buildStructuredPrompt([
        section("章节规划", input.planContent),
        section("章节草稿", input.draftContent),
        ...buildReadableContextSections(contextBlocks),
        input.retrievedContext ? section("召回上下文（作为核对基准）", "以上事实块用于核对草稿是否违反已知约束。") : null,
        section("输出要求", [
          "请严格返回 JSON 对象，字段必须为 summary, issues, risks, continuity_checks, repair_suggestions。",
          "不要输出中文键名、Markdown 代码块或额外解释。",
          "优先指出会导致后续章节连锁出错的问题。",
          "如果没有问题，也要明确说明连续性是否稳定。",
        ]),
      ]),
    },
  ];
}

export function buildRepairPrompt(input: {
  planContent: string;
  draftContent: string;
  reviewContent: string;
  intentConstraints?: PlanIntentConstraints;
  retrievedContext?: unknown;
}): LlmMessage[] {
  const contextBlocks = input.retrievedContext ? buildPromptContextBlocks(input.retrievedContext) : null;
  return [
    {
      role: "system",
      content:
        [
          "你是一名小说修稿助手。",
          "请根据章节规划、召回上下文和审阅意见修复章节草稿，尽量少破坏已有可用内容，并保持主线、设定和人物行为一致。",
          "召回上下文中的 hardConstraints 默认都应视为硬约束。",
          "supportingOutlines 和 recentChapters 用于帮助修稿时保持承接，但不应覆盖硬约束。",
        ].join(""),
    },
    {
      role: "user",
      content: buildStructuredPrompt([
        section("章节规划", input.planContent),
        section("当前草稿", input.draftContent),
        section("审阅结果", input.reviewContent),
        buildIntentConstraintsSection(input.intentConstraints),
        ...buildReadableContextSections(contextBlocks),
        input.retrievedContext
          ? jsonSection(
              "召回上下文（必须保持一致）",
              buildCompactRetrievedContextForPrompt({
                retrievedContext: input.retrievedContext as PlanRetrievedContext,
                mode: "repair",
              }),
            )
          : null,
        section("修稿要求", [
          "优先修复审阅问题，同时不要偏离既有规划和召回设定。",
          "如果存在必须包含或必须避免的意图约束，修稿后必须继续满足。",
          "如果草稿已有可用段落，尽量保留其节奏、气氛和信息密度。",
          "只输出修复后的完整草稿正文。",
        ]),
      ]),
    },
  ];
}

export function buildApprovePrompt(input: {
  planContent: string;
  draftContent: string;
  reviewContent: string;
  intentConstraints?: PlanIntentConstraints;
  retrievedContext?: unknown;
}): LlmMessage[] {
  const contextBlocks = input.retrievedContext ? buildPromptContextBlocks(input.retrievedContext) : null;
  // approve prompt 只负责产出最终正文，不承担结构化回写任务；
  // 事实抽取会在 approve diff 的独立 prompt 中完成。
  return [
    {
      role: "system",
      content:
        [
          "你是一名长篇小说定稿助手。",
          "请基于章节规划、当前草稿、审阅结果和召回上下文，输出可直接作为正式稿保存的最终章节文稿。",
          "你必须修复审阅里指出的问题，同时保留章节原本应推进的主线、支线、人物关系和钩子。",
          "召回上下文中的 hardConstraints 默认都应视为正式约束。",
          "supportingOutlines、recentChapters 和 riskReminders 用于辅助你承接语境，但不能覆盖硬约束。",
          "输出时只给最终正文，不要附带说明、批注、总结或解释。",
        ].join(""),
    },
    {
      role: "user",
      content: buildStructuredPrompt([
        section("章节规划", input.planContent),
        section("当前草稿", input.draftContent),
        section("审阅结果", input.reviewContent),
        buildIntentConstraintsSection(input.intentConstraints),
        ...buildReadableContextSections(contextBlocks),
        input.retrievedContext ? section("召回上下文（必须保持一致）", "以上事实块为正式稿的主要约束与承接基准。") : null,
        section("定稿要求", [
          "1. 修复审阅中提到的问题。",
          "2. 不要丢失原计划中的关键剧情推进和钩子推进。",
          "3. 不要违背召回出的设定、人物状态、关系和世界规则。",
          "4. 尽量继承当前草稿中已经写得好的段落和气氛。",
          "5. 如果存在必须包含或必须避免的意图约束，最终文稿必须满足。",
          "6. 只输出最终文稿正文。",
        ]),
      ]),
    },
  ];
}

export function buildApproveDiffPrompt(input: {
  finalContent: string;
  planContent: string;
  reviewContent: string;
  retrievedContext?: unknown;
}): LlmMessage[] {
  const contextBlocks = input.retrievedContext ? buildPromptContextBlocks(input.retrievedContext) : null;
  return [
    {
      role: "system",
      content:
        [
          "你是一名小说事实整理助手。",
          "请根据最终文稿、章节规划和审阅结果，输出结构化 JSON，用于更新设定数据库。",
          "召回上下文中的 hardConstraints 和 recentChapters 主要用于校对事实变更，不用于自由补写新事实。",
        ].join(""),
    },
    {
      role: "user",
      content: buildStructuredPrompt([
        section("最终文稿", input.finalContent),
        section("章节规划", input.planContent),
        section("审阅结果", input.reviewContent),
        ...buildReadableContextSections(contextBlocks),
        input.retrievedContext ? section("召回上下文（用于校对事实变更）", "以上事实块用于判断哪些变化属于真实、可回写的结构化事实。") : null,
        section("输出要求", [
          "请返回 JSON。",
          "字段包含：chapterSummary, actualCharacterIds, actualFactionIds, actualItemIds, actualHookIds, actualWorldSettingIds, newCharacters, newFactions, newItems, newHooks, newWorldSettings, newRelations, updates。",
          "newRelations 用于新增关系，字段包含 sourceType, sourceId, targetType, targetId, relationType, intensity, status, description, keywords。",
          "updates 中的 entityType 支持 character, faction, relation, item, story_hook, world_setting；action 支持 update_fields, append_notes, status_change。",
          "actual*Ids 应只保留本章真实出场或真实产生影响的实体。",
        ]),
      ]),
    },
  ];
}

function buildStructuredPrompt(sections: Array<string | null>): string {
  return sections.filter(Boolean).join("\n\n");
}

function section(title: string, content: string | string[]): string {
  const normalized = Array.isArray(content) ? content.join("\n") : content;
  return `${title}：\n${normalized}`;
}

function jsonSection(title: string, content: unknown): string {
  return section(title, JSON.stringify(content, null, 2));
}

function buildReadableContextSections(contextBlocks: ReturnType<typeof buildPromptContextBlocks> | null): Array<string | null> {
  if (!contextBlocks) {
    return [];
  }

  return [
    buildListSection("本章必须遵守的事实", contextBlocks.mustFollowFacts),
    buildListSection("最近承接的变化", contextBlocks.recentChanges),
    buildListSection("本章核心人物/势力/关系", contextBlocks.coreEntities),
    buildListSection("必须推进的钩子", contextBlocks.requiredHooks),
    buildListSection("禁止改写与禁止新增", contextBlocks.forbiddenMoves),
    buildListSection("补充背景", contextBlocks.supportingBackground),
  ];
}

function buildListSection(title: string, lines: string[]): string | null {
  if (lines.length === 0) {
    return null;
  }

  return section(title, lines.map((line, index) => `${index + 1}. ${line}`));
}

function buildIntentConstraintsSection(input?: PlanIntentConstraints): string | null {
  if (!input) {
    return null;
  }

  const lines = [
    input.intentSummary ? `意图摘要：${input.intentSummary}` : null,
    input.mustInclude && input.mustInclude.length > 0
      ? `必须包含：${input.mustInclude.join("；")}`
      : null,
    input.mustAvoid && input.mustAvoid.length > 0
      ? `必须避免：${input.mustAvoid.join("；")}`
      : null,
  ].filter(Boolean) as string[];

  if (lines.length === 0) {
    return null;
  }

  return section("意图约束", lines);
}

function buildCompactRetrievedContextForPrompt(input: {
  retrievedContext: PlanRetrievedContext;
  mode: "plan" | "repair";
}): {
  hardConstraints: PlanRetrievedContext["hardConstraints"];
  riskReminders: string[];
  recentChanges: PlanRetrievedContext["recentChanges"];
  priorityContext: {
    blockingConstraints: NonNullable<PlanRetrievedContext["priorityContext"]>["blockingConstraints"];
    decisionContext: NonNullable<PlanRetrievedContext["priorityContext"]>["decisionContext"];
  };
} {
  const recentChanges = input.retrievedContext.recentChanges ?? [];
  const priorityContext = input.retrievedContext.priorityContext;

  return {
    hardConstraints: input.retrievedContext.hardConstraints,
    riskReminders: input.retrievedContext.riskReminders,
    recentChanges,
    priorityContext: {
      blockingConstraints: priorityContext?.blockingConstraints.slice(0, 6) ?? [],
      decisionContext: input.mode === "repair"
        ? priorityContext?.decisionContext.slice(0, 4) ?? []
        : [],
    },
  };
}
