import assert from 'node:assert/strict'
import test from 'node:test'

import { BookRepository } from '../../../../src/infra/repository/book-repository.js'
import { ChapterOutcomeRepository } from '../../../../src/infra/repository/chapter-outcome-repository.js'
import { createBookFixture } from '../../../helpers/domain-fixtures.js'
import { insertVolumeAndChapter, withSqliteDatabase } from '../../../helpers/sqlite.js'

test('ChapterOutcomeRepository persists outcomes and resolves latest/list queries', async () => {
  await withSqliteDatabase(async (database) => {
    await new BookRepository(database).createAsync(createBookFixture())
    await insertVolumeAndChapter(database, { bookId: 'book-1', volumeId: 'volume-1', chapterId: 'chapter-1' })
    const repository = new ChapterOutcomeRepository(database)

    repository.create({
      id: 'outcome-1',
      bookId: 'book-1',
      chapterId: 'chapter-1',
      decision: 'warning',
      resolvedFacts: [{ summary: '角色成功潜入', factType: 'plot', source: 'review' }],
      observationFacts: [{ summary: '守卫增多', reason: '现场观察', source: 'review' }],
      contradictions: [],
      narrativeDebts: [],
      characterArcProgress: [{ characterId: 'character-1', arc: '成长', stage: 'rising', summary: '开始动摇' }],
      hookDebtUpdates: [{ hookId: 'hook-1', pressure: 'high', summary: '谜团压力上升' }],
      createdAt: '2026-04-06T00:10:00.000Z',
    })
    await repository.createAsync({
      id: 'outcome-2',
      bookId: 'book-1',
      chapterId: 'chapter-1',
      decision: 'pass',
      resolvedFacts: [],
      observationFacts: [],
      contradictions: [],
      narrativeDebts: [],
      characterArcProgress: [],
      hookDebtUpdates: [],
      createdAt: '2026-04-06T00:20:00.000Z',
    })

    const latestSync = repository.getLatestByChapterId('chapter-1')
    const latestAsync = await repository.getLatestByChapterIdAsync('chapter-1')
    const listSync = repository.listByChapterId('chapter-1')
    const listAsync = await repository.listByChapterIdAsync('chapter-1')

    assert.equal(latestSync?.id, 'outcome-2')
    assert.equal(latestAsync?.decision, 'pass')
    assert.equal(listSync.length, 2)
    assert.equal(listAsync[1]?.id, 'outcome-1')
    assert.equal(repository.getLatestByChapterId('missing-chapter'), null)
  })
})