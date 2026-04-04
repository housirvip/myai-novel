import { formatJson, formatSection } from '../../../shared/utils/format.js'

export function printDoctorVolumeSummary(input: {
  volume: {
    id: string
    title: string
    goal: string
    summary: string
  }
  diagnostics: {
    chapterCount: number
    finalizedOutputCount: number
    hasVolumePlan: boolean
    threadCount: number
    endingTargetMatches: boolean
  }
  chapters: unknown
}): void {
  console.log(`Doctor volume: ${input.volume.title} (${input.volume.id})`)
  console.log(`Goal: ${input.volume.goal}`)
  console.log(`Summary: ${input.volume.summary}`)
  console.log(formatSection('Volume diagnostics:', formatJson(input.diagnostics)))
  console.log(formatSection('Volume chapters:', formatJson(input.chapters)))
}
