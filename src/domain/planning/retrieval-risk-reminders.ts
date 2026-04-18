import type { PlanRetrievedContextEntityGroups, RetrievedChapterSummary } from "./types.js";

export function buildRiskReminders(input: {
  hardConstraints: PlanRetrievedContextEntityGroups;
  recentChapters: RetrievedChapterSummary[];
}): string[] {
  // risk reminders 是写给模型看的“负面提醒”，不是给工程侧做严格校验的规则列表。
  // 这里宁可短一些，也要确保每条都直指最容易出戏的连续性风险。
  const reminders: string[] = [];

  if (input.hardConstraints.hooks.some((hook) => hook.reason.includes("chapter_proximity"))) {
    reminders.push("存在接近回收节点的重要钩子，正文中要么推进、要么明确交代，避免直接遗忘。");
  }

  if (input.recentChapters.length > 0) {
    reminders.push(`注意承接最近 ${input.recentChapters.length} 章的状态延续和人物位置变化。`);
  }

  if (input.hardConstraints.characters.some((character) => character.content.includes("current_location="))) {
    reminders.push("注意人物当前位置连续性，避免人物在没有过渡的情况下突然更换场景。");
  }

  if (
    input.hardConstraints.items.some((item) =>
      item.content.includes("owner_type=")
      || item.content.includes("owner_id=")
      || item.content.includes("status="),
    )
  ) {
    reminders.push("注意关键物品的持有者与状态连续性，避免无交代易主、失踪或突然恢复。");
  }

  if (input.hardConstraints.worldSettings.length > 0) {
    reminders.push("注意不要违反已激活的世界规则、职业体系、制度边界或货币体系。");
  }

  return [...new Set(reminders)];
}
