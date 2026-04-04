import { formatJson, formatSection } from '../../../shared/utils/format.js'

export function printRegressionVolumeRun(input: {
  volumeId: string
  cases: string[]
  status: string
  note: string
}): void {
  console.log(formatSection('Regression volume run:', formatJson(input)))
}
