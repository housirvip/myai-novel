import { formatJson, formatSection } from '../../../shared/utils/format.js'

export function printStateVolumeSummary(input: {
  book: { id: string; title: string }
  volume: {
    id: string
    title: string
    goal: string
    summary: string
    chapterIds: string[]
  }
  chapters: Array<{
    id: string
    index: number
    title: string
    status: string
  }>
  latestVolumePlan: unknown | null
  storyThreads: unknown[]
  endingReadiness: unknown | null
}): void {
  console.log(`Book: ${input.book.title}`)
  console.log(`Volume: ${input.volume.title} (${input.volume.id})`)
  console.log(`Goal: ${input.volume.goal}`)
  console.log(`Summary: ${input.volume.summary}`)
  console.log(`Chapter count: ${input.chapters.length}`)
  console.log(formatSection('Volume chapters:', formatJson(input.chapters)))
  console.log(formatSection('Latest volume plan:', formatJson(input.latestVolumePlan)))
  console.log(formatSection('Story threads:', formatJson(input.storyThreads)))
  console.log(formatSection('Ending readiness current:', formatJson(input.endingReadiness)))
}
