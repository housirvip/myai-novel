import { formatJson, formatSection } from '../../../shared/utils/format.js'

export function printDoctorProjectSummary(input: {
  bookId: string
  chapterCount: number
  operationLogDir: string
  chapters: unknown
}): void {
  console.log(formatSection('Doctor summary:', formatJson(input)))
}

export function printDoctorChapterSummary(input: {
  chapter: { index: number; title: string }
  workflowChain: unknown
}): void {
  console.log(`Doctor chapter: #${input.chapter.index} ${input.chapter.title}`)
  console.log(formatSection('Workflow chain:', formatJson(input.workflowChain)))
}
