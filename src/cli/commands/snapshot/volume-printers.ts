import { formatJson, formatSection } from '../../../shared/utils/format.js'

// 卷快照同样保持“少解释、全量展示”，适合对照 volume plan / threads / ending readiness 做一次性检查。
export function printVolumeSnapshot(snapshot: {
  volume: unknown
  latestVolumePlan: unknown
  storyThreads: unknown
  endingReadiness: unknown
  chapters: unknown
}): void {
  console.log(formatSection('Volume snapshot:', formatJson(snapshot)))
}
