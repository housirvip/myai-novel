import { Command } from 'commander'

import { BookRepository } from '../../infra/repository/book-repository.js'
import { ChapterDraftRepository } from '../../infra/repository/chapter-draft-repository.js'
import { ChapterOutputRepository } from '../../infra/repository/chapter-output-repository.js'
import { ChapterPlanRepository } from '../../infra/repository/chapter-plan-repository.js'
import { ChapterRepository } from '../../infra/repository/chapter-repository.js'
import { ChapterReviewRepository } from '../../infra/repository/chapter-review-repository.js'
import { ChapterRewriteRepository } from '../../infra/repository/chapter-rewrite-repository.js'
import { NovelError } from '../../shared/utils/errors.js'
import { formatJson, formatSection } from '../../shared/utils/format.js'
import { resolveOperationLogDir } from '../../shared/utils/project-paths.js'
import { openProjectDatabase } from '../context.js'

export function registerDoctorCommands(program: Command): void {
  const doctorCommand = program.command('doctor').description('Run diagnostic checks')

  doctorCommand
    .description('Run project-level diagnostics')
    .action(async () => {
      const database = await openProjectDatabase()

      try {
        const book = new BookRepository(database).getFirst()

        if (!book) {
          throw new NovelError('Project is not initialized. Run `novel init` first.')
        }

        const chapterRepository = new ChapterRepository(database)
        const planRepository = new ChapterPlanRepository(database)
        const draftRepository = new ChapterDraftRepository(database)
        const reviewRepository = new ChapterReviewRepository(database)
        const rewriteRepository = new ChapterRewriteRepository(database)
        const outputRepository = new ChapterOutputRepository(database)
        const chapters = chapterRepository.listByBookId(book.id)
        const diagnostics = chapters.map((chapter) => ({
          chapterId: chapter.id,
          title: chapter.title,
          status: chapter.status,
          hasPlan: Boolean(planRepository.getLatestByChapterId(chapter.id)),
          hasDraft: Boolean(draftRepository.getLatestByChapterId(chapter.id)),
          hasReview: Boolean(reviewRepository.getLatestByChapterId(chapter.id)),
          hasRewrite: Boolean(rewriteRepository.getLatestByChapterId(chapter.id)),
          hasOutput: Boolean(outputRepository.getLatestByChapterId(chapter.id)),
        }))

        console.log(
          formatSection(
            'Doctor summary:',
            formatJson({
              bookId: book.id,
              chapterCount: chapters.length,
              operationLogDir: resolveOperationLogDir(process.cwd()),
              chapters: diagnostics,
            }),
          ),
        )
      } finally {
        database.close()
      }
    })

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
