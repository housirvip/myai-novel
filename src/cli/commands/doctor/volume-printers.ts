import type { DoctorVolumeRisk, DoctorVolumeView } from './volume-services.js'

import { formatJson, formatSection } from '../../../shared/utils/format.js'

export function printDoctorVolumeSummary(input: DoctorVolumeView): void {
  console.log(`Doctor volume: ${input.volume.title} (${input.volume.id})`)
  console.log(`Goal: ${input.volume.goal}`)
  console.log(`Summary: ${input.volume.summary}`)
  console.log(
    formatSection(
      'Overall risk summary:',
      formatJson({
        overallLevel: input.overview.overallLevel,
        summary: input.overview.summary,
        diagnostics: input.diagnostics,
      }),
    ),
  )
  console.log(formatSection('Mission risks:', formatRiskList(input.missionRisks)))
  console.log(formatSection('Thread risks:', formatRiskList(input.threadRisks)))
  console.log(formatSection('Ending risks:', formatRiskList(input.endingRisks)))
  console.log(formatSection('Chapter risks:', formatRiskList(input.chapterRisks)))
  console.log(formatSection('Volume chapters:', formatJson(input.chapters)))
}

function formatRiskList(risks: DoctorVolumeRisk[]): string {
  if (risks.length === 0) {
    return '(none)'
  }

  return risks.map(formatRisk).join('\n\n')
}

function formatRisk(risk: DoctorVolumeRisk): string {
  const relatedIds = risk.relatedIds.length > 0 ? `\nrelated: ${risk.relatedIds.join(', ')}` : ''
  return `- [${risk.level}] ${risk.code}: ${risk.summary}\ndetail: ${risk.detail}${relatedIds}`
}
