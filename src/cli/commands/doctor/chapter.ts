import { Command } from 'commander'

import { ChapterDraftRepository } from '../../../infra/repository/chapter-draft-repository.js'
import { ChapterOutputRepository } from '../../../infra/repository/chapter-output-repository.js'
import { ChapterPlanRepository } from '../../../infra/repository/chapter-plan-repository.js'
import { ChapterRepository } from '../../../infra/repository/chapter-repository.js'
import { ChapterReviewRepository } from '../../../infra/repository/chapter-review-repository.js'
import { ChapterRewriteRepository } from '../../../infra/repository/chapter-rewrite-repository.js'
import { NovelError } from '../../../shared/utils/errors.js'
import { formatJson, formatSection } from '../../../shared/utils/format.js'
import { resolveOperationLogDir } from '../../../shared/utils/project-paths.js'
import { openProjectDatabase } from '../../context.js'

export function registerDoctorChapterCommand(doctorCommand: Command): void {
  doctorCommand
    .command('chapter <chapterId>')
    .description('Run diagnostics for a single chapter')
    .action(async (chapterId: string) => {
      const database = await openProjectDatabase()

      try {
        const chapterRepository = new ChapterRepository(database)
        const planRepository = new ChapterPlanRepository(database)
        const draftRepository = new ChapterDraftRepository(database)
        const reviewRepository = new ChapterReviewRepository(database)
        const rewriteRepository = new ChapterRewriteRepository(database)
        const outputRepository = new ChapterOutputRepository(database)
        const chapter = chapterRepository.getById(chapterId)

        if (!chapter) {
          throw new NovelError(`Chapter not found: ${chapterId}`)
        }

        console.log(`Doctor chapter: #${chapter.index} ${chapter.title}`)
        console.log(
          formatSection(
            'Workflow chain:',
            formatJson({
              chapterId: chapter.id,
              status: chapter.status,
              currentPlanVersionId: chapter.currentPlanVersionId ?? null,
              currentVersionId: chapter.currentVersionId ?? null,
              latestPlanId: planRepository.getLatestByChapterId(chapterId)?.versionId ?? null,
              latestDraftId: draftRepository.getLatestByChapterId(chapterId)?.id ?? null,
              latestReviewId: reviewRepository.getLatestByChapterId(chapterId)?.id ?? null,
              latestRewriteId: rewriteRepository.getLatestByChapterId(chapterId)?.id ?? null,
              latestOutputId: outputRepository.getLatestByChapterId(chapterId)?.id ?? null,
              operationLogDir: resolveOperationLogDir(process.cwd()),
            }),
          ),
        )
      } finally {
        database.close()
      }
    })
}
