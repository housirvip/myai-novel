import { formatJson, formatSection } from '../../../shared/utils/format.js'

// doctor 输出按“能不能跑”与“链路有没有断”两层组织，便于先看基础设施，再看章节覆盖率。
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
        timeoutMs: number
        maxRetries: number
        isDefault: boolean
        usedByStages: string[]
      }>
      stageRouting: Array<{
        stage: string
        provider: string
        model: string
        timeoutMs: number
        maxRetries: number
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
      // 数据库部分只挑 readiness 相关字段，避免把 config 细节重复散落在多个 section。
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
      // defaults 与 readiness 放在一起，方便快速判断“默认会走哪里”以及“那里是否已配置”。
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
  // chapter doctor 重点就是 current 指针是否落后于 latest 产物，所以直接展示 workflow chain 全貌。
  console.log(formatSection('Workflow chain:', formatJson(input.workflowChain)))
}
