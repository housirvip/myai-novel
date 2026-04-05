import { Command } from 'commander'

import { ChapterDraftRepository } from '../../../infra/repository/chapter-draft-repository.js'
import { NovelError } from '../../../shared/utils/errors.js'
import { formatJson, formatSection } from '../../../shared/utils/format.js'
import { openProjectDatabase } from '../../context.js'

export function registerWorkflowDraftShowCommand(draftCommand: Command): void {
  draftCommand
    .command('show <chapterId>')
    .description('Show the latest draft for a chapter')
    .action(async (chapterId: string) => {
      const database = await openProjectDatabase()

      try {
        const draft = new ChapterDraftRepository(database).getLatestByChapterId(chapterId)

        if (!draft) {
          throw new NovelError(`No chapter draft found for chapter: ${chapterId}`)
        }

        console.log(`Draft id: ${draft.id}`)
        console.log(`Version: ${draft.versionId}`)
        console.log(`Word count: ${draft.actualWordCount}`)
        console.log(formatSection('Content preview:', draft.content))

        if (draft.llmMetadata) {
          console.log(formatSection('LLM metadata:', formatJson(draft.llmMetadata)))
        }
      } finally {
        database.close()
      }
    })
}
