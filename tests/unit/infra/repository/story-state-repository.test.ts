import assert from 'node:assert/strict'
import test from 'node:test'

import { StoryStateRepository } from '../../../../src/infra/repository/story-state-repository.js'
import { BookRepository } from '../../../../src/infra/repository/book-repository.js'
import { createBookFixture } from '../../../helpers/domain-fixtures.js'
import { insertVolumeAndChapter, withSqliteDatabase } from '../../../helpers/sqlite.js'

test('StoryStateRepository upsert persists and updates story current state', async () => {
  await withSqliteDatabase(async (database) => {
    await new BookRepository(database).createAsync(createBookFixture())
    await insertVolumeAndChapter(database, { bookId: 'book-1', chapterId: 'chapter-1', volumeId: 'volume-1' })
    await database.dbAsync.run(
      `
        INSERT INTO chapters (
          id,
          book_id,
          volume_id,
          chapter_index,
          title,
          objective,
          planned_beats_json,
          status,
          current_plan_version_id,
          current_version_id,
          draft_path,
          final_path,
          approved_at,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      'chapter-2',
      'book-1',
      'volume-1',
      2,
      '余波',
      '继续追查密信来源',
      JSON.stringify(['复盘线索']),
      'planned',
      null,
      null,
      null,
      null,
      null,
      '2026-04-06T00:05:00.000Z',
      '2026-04-06T00:05:00.000Z',
    )
    const repository = new StoryStateRepository(database)

    await repository.upsertAsync({
      bookId: 'book-1',
      currentChapterId: 'chapter-1',
      recentEvents: ['潜入据点'],
      updatedAt: '2026-04-06T00:00:00.000Z',
    })

    const created = await repository.getByBookIdAsync('book-1')
    assert.deepEqual(created, {
      bookId: 'book-1',
      currentChapterId: 'chapter-1',
      recentEvents: ['潜入据点'],
      updatedAt: '2026-04-06T00:00:00.000Z',
    })

    await repository.upsertAsync({
      bookId: 'book-1',
      currentChapterId: 'chapter-2',
      recentEvents: ['发现密信'],
      updatedAt: '2026-04-06T00:10:00.000Z',
    })

    const updated = repository.getByBookId('book-1')
    assert.deepEqual(updated, {
      bookId: 'book-1',
      currentChapterId: 'chapter-2',
      recentEvents: ['发现密信'],
      updatedAt: '2026-04-06T00:10:00.000Z',
    })
    assert.equal(repository.getByBookId('missing-book'), null)
  })
})