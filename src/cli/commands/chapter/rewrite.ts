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
  return [chapterId, '--strategy', strategy, ...goals.flatMap((goal) => ['--goal', goal])]
}
