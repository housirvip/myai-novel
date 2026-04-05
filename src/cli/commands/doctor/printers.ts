import { formatJson, formatSection } from '../../../shared/utils/format.js'

export function printDoctorProjectSummary(input: {
  projectInitialized: boolean
  bookId?: string
  chapterCount: number
  operationLogDir: string
  infrastructure: {
    database: {
      activeBackend: string
      configPath: string
      configPresent: boolean
      readiness: {
        status: string
        issues: string[]
      }
    }
    llm: {
      defaultProvider: string
      defaultModel: string
      availableProviders: string[]
      readiness: {
        defaultProviderConfigured: boolean
        configuredProviderCount: number
        stageRoutingIssues: string[]
      }
      configuredProviders: Array<{
        provider: string
        configured: boolean
        baseUrl: string
        defaultModel: string
        isDefault: boolean
        usedByStages: string[]
      }>
      stageRouting: Array<{
        stage: string
        provider: string
        model: string
        providerConfigured: boolean
      }>
    }
  }
  chapters: unknown
}): void {
  console.log(`Project initialized: ${input.projectInitialized}`)
  console.log(`Book id: ${input.bookId ?? '(none)'}`)
  console.log(`Chapter count: ${input.chapterCount}`)
  console.log(`Operation log dir: ${input.operationLogDir}`)
  console.log(
    formatSection(
      'Database infrastructure:',
      formatJson({
        activeBackend: input.infrastructure.database.activeBackend,
        configPath: input.infrastructure.database.configPath,
        configPresent: input.infrastructure.database.configPresent,
        readiness: input.infrastructure.database.readiness,
      }),
    ),
  )
  console.log(
    formatSection(
      'LLM defaults:',
      formatJson({
        defaultProvider: input.infrastructure.llm.defaultProvider,
        defaultModel: input.infrastructure.llm.defaultModel,
        availableProviders: input.infrastructure.llm.availableProviders,
        readiness: input.infrastructure.llm.readiness,
      }),
    ),
  )
  console.log(formatSection('Configured providers:', formatJson(input.infrastructure.llm.configuredProviders)))
  console.log(formatSection('Stage routing:', formatJson(input.infrastructure.llm.stageRouting)))
  console.log(formatSection('Chapter coverage:', formatJson(input.chapters)))
}

export function printDoctorChapterSummary(input: {
  chapter: { index: number; title: string }
  workflowChain: unknown
}): void {
  console.log(`Doctor chapter: #${input.chapter.index} ${input.chapter.title}`)
  console.log(formatSection('Workflow chain:', formatJson(input.workflowChain)))
}
