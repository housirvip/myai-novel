import { Command } from 'commander'

import { createWorkflowGenerationService } from '../workflow-services.js'
import { printWorkflowDraftCreated } from '../workflow-printers.js'
import { runLoggedCommand, summarizeLlmMetadata } from '../../context.js'

export function registerWorkflowWriteNextCommand(writeCommand: Command): void {
  writeCommand
    .command('next <chapterId>')
    .description('Generate the next chapter draft from the latest plan')
    .action(async (chapterId: string) => {
      const result = await runLoggedCommand({
        command: 'write next',
        args: [chapterId],
        chapterId,
        action: async (database) => {
          const generationService = createWorkflowGenerationService(database)
          const writeResult = await generationService.writeNext(chapterId)

          return {
            result: writeResult,
            chapterId,
            summary: `Chapter draft created: ${writeResult.draftId}`,
            detail: {
              draftId: writeResult.draftId,
              chapterStatus: writeResult.chapterStatus,
              wordCount: writeResult.actualWordCount,
              nextAction: writeResult.nextAction,
              llm: summarizeLlmMetadata(writeResult.llmMetadata),
            },
          }
        },
      })

      printWorkflowDraftCreated(result)
    })
}
