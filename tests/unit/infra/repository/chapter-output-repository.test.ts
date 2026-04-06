import assert from 'node:assert/strict'
import test from 'node:test'

import { BookRepository } from '../../../../src/infra/repository/book-repository.js'
import { ChapterOutputRepository } from '../../../../src/infra/repository/chapter-output-repository.js'
import { createBookFixture } from '../../../helpers/domain-fixtures.js'
import { insertVolumeAndChapter, withSqliteDatabase } from '../../../helpers/sqlite.js'

// chapter_output 是最终导出产物表，这里只关心“同章多份输出时谁算最新”。
test('ChapterOutputRepository persists outputs and resolves latest by chapter id', async () => {
  await withSqliteDatabase(async (database) => {
    await new BookRepository(database).createAsync(createBookFixture())
    await insertVolumeAndChapter(database, { bookId: 'book-1', volumeId: 'volume-1', chapterId: 'chapter-1' })
    const repository = new ChapterOutputRepository(database)

    repository.create({
      id: 'output-1',
      bookId: 'book-1',
      chapterId: 'chapter-1',
      sourceType: 'draft',
      sourceId: 'draft-1',
      finalPath: 'final/ch1-draft.md',
      content: '草稿终稿',
      createdAt: '2026-04-06T00:10:00.000Z',
    })
    await repository.createAsync({
      id: 'output-2',
      bookId: 'book-1',
      chapterId: 'chapter-1',
      sourceType: 'rewrite',
      sourceId: 'rewrite-1',
      finalPath: 'final/ch1-rewrite.md',
      content: '重写终稿',
      createdAt: '2026-04-06T00:20:00.000Z',
    })

    // rewrite 输出比 draft 输出更新，应成为最新 final artifact。
    const latestSync = repository.getLatestByChapterId('chapter-1')
    const latestAsync = await repository.getLatestByChapterIdAsync('chapter-1')

    assert.equal(latestSync?.id, 'output-2')
    assert.equal(latestAsync?.sourceType, 'rewrite')
    assert.equal(repository.getLatestByChapterId('missing-chapter'), null)
  })
})
