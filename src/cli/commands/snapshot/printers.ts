import { formatJson, formatSection } from '../../../shared/utils/format.js'

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
  console.log(formatSection('Chapter snapshot:', formatJson(snapshot)))
}
