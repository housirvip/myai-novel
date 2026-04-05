import { formatJson, formatSection } from '../../../shared/utils/format.js'

export function printRegressionCases(cases: readonly string[]): void {
  console.log(formatSection('Regression cases:', formatJson(cases)))
}

export function printRegressionRun(input: {
  caseName: string
  targetId?: string
  known: boolean
  status: string
  summary: string
  steps: Array<{ name: string; status: string; detail: string }>
  artifacts: Array<{ name: string; status: string; detail: string }>
}): void {
  console.log(`Regression case: ${input.caseName}`)

  if (input.targetId) {
    console.log(`Target: ${input.targetId}`)
  }

  console.log(`Known: ${input.known}`)
  console.log(`Status: ${input.status}`)
  console.log(`Summary: ${input.summary}`)
  console.log(formatSection('Steps:', formatJson(input.steps)))
  console.log(formatSection('Artifacts:', formatJson(input.artifacts)))
}

export function printRegressionVolumeSuite(input: {
  volumeId: string
  caseCount: number
  passedCount: number
  warningCount: number
  missingPrerequisiteCount: number
  summary: string
  results: unknown
}): void {
  console.log(`Regression volume suite: ${input.volumeId}`)
  console.log(`Case count: ${input.caseCount}`)
  console.log(`Passed: ${input.passedCount}`)
  console.log(`Warnings: ${input.warningCount}`)
  console.log(`Missing prerequisites: ${input.missingPrerequisiteCount}`)
  console.log(`Summary: ${input.summary}`)
  console.log(formatSection('Results:', formatJson(input.results)))
}
