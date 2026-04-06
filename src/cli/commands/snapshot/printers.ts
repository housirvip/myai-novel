import { formatJson, formatSection } from '../../../shared/utils/format.js'

// snapshot 命令强调“原样快照”，因此这里不做摘要裁剪，直接把聚合结果整体打印出来。
export function printStateSnapshot(snapshot: {
  storyState: unknown
  chapters: unknown
}): void {
  console.log(formatSection('State snapshot:', formatJson(snapshot)))
}

export function printChapterSnapshot(snapshot: {
  chapter: unknown
  latestPlan: unknown
  latestDraft: unknown
  latestReview: unknown
  latestRewrite: unknown
  latestOutput: unknown
}): void {
  // 章节快照用于人工核对当前链路指针，保持完整 JSON 比再加工更可靠。
  console.log(formatSection('Chapter snapshot:', formatJson(snapshot)))
}
