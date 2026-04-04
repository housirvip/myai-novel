import { formatJson, formatSection } from '../../../shared/utils/format.js'

export function printRegressionCases(cases: readonly string[]): void {
  console.log(formatSection('Regression cases:', formatJson(cases)))
}

export function printRegressionRun(input: {
  caseName: string
  known: boolean
  status: string
  note: string
}): void {
  console.log(formatSection('Regression run:', formatJson(input)))
}
