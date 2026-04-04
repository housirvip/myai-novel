import { formatJson, formatSection } from '../../../shared/utils/format.js'

export function printVolumeSnapshot(snapshot: {
  volume: unknown
  latestVolumePlan: unknown
  storyThreads: unknown
  endingReadiness: unknown
  chapters: unknown
}): void {
  console.log(formatSection('Volume snapshot:', formatJson(snapshot)))
}
