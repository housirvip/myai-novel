import { Command } from 'commander'

import { createChapterRewriteService } from '../chapter-services.js'
import { printChapterRewriteCreated } from '../chapter-printers.js'
import { runLoggedCommand, summarizeLlmMetadata } from '../../context.js'

export function registerChapterRewriteCommand(chapterCommand: Command): void {
  chapterCommand
    .command('rewrite <chapterId>')
    .description('Rewrite the latest draft for a chapter')
    .option('--goal <items...>', 'One or more rewrite goals')
    .option('--strategy <strategy>', 'Rewrite strategy: full or partial', 'partial')
    .action(async (chapterId: string, options) => {
      const strategy = options.strategy === 'full' ? 'full' : 'partial'
      // 未显式提供 goal 时给一个保守默认值，保证命令可直接运行且符合当前产品预期。
      const goals = options.goal ?? ['优化节奏与结尾牵引']
      const rewrite = await runLoggedCommand({
        command: 'chapter rewrite',
        args: buildRewriteArgs(chapterId, strategy, goals),
        chapterId,
        detail: { strategy, goals },
        action: async (database) => {
          const rewriteService = createChapterRewriteService(database)

          const result = await rewriteService.rewriteChapter({
            chapterId,
            strategy,
            goals,
            // chapter rewrite 默认是“保守改写”，避免单次优化意外破坏既有事实和伏笔推进。
            preserveFacts: true,
            preserveHooks: true,
            preserveEndingBeat: true,
          })

          return {
            result,
            chapterId,
            bookId: result.bookId,
            summary: `Chapter rewrite created: ${result.id}`,
            detail: {
              rewriteId: result.id,
              versionId: result.versionId,
              strategy: result.strategy,
              goals: result.goals,
              wordCount: result.actualWordCount,
              validation: result.validation,
              llm: summarizeLlmMetadata(result.llmMetadata),
            },
          }
        },
      })

      printChapterRewriteCreated(rewrite)
    })
}

function buildRewriteArgs(chapterId: string, strategy: 'full' | 'partial', goals: string[]): string[] {
  // 统一由这里生成日志参数，避免 action 内外各自拼接导致顺序不一致。
  return [chapterId, '--strategy', strategy, ...goals.flatMap((goal) => ['--goal', goal])]
}
