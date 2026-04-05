import assert from 'node:assert/strict'
import test from 'node:test'

import { BookRepository } from '../../../../src/infra/repository/book-repository.js'
import { VolumeRepository } from '../../../../src/infra/repository/volume-repository.js'
import { withEnv } from '../../../helpers/env.js'
import { createBookFixture, createVolumeFixture } from '../../../helpers/domain-fixtures.js'
import { insertVolumeAndChapter, withSqliteDatabase } from '../../../helpers/sqlite.js'

const resetLlmEnv = {
  LLM_PROVIDER: undefined,
  OPENAI_API_KEY: undefined,
  OPENAI_MODEL: undefined,
  OPENAI_COMPATIBLE_API_KEY: undefined,
  OPENAI_COMPATIBLE_MODEL: undefined,
} satisfies Record<string, string | undefined>

test('VolumeRepository supports create/get/update/list queries', async () => {
  await withSqliteDatabase(async (database) => {
    await withEnv(
      {
        ...resetLlmEnv,
        LLM_PROVIDER: 'openai',
        OPENAI_MODEL: 'gpt-openai',
      },
      async () => {
        await new BookRepository(database).createAsync(createBookFixture())

        const repository = new VolumeRepository(database)
        const volume = createVolumeFixture({ chapterIds: ['chapter-1'] })

        await repository.createAsync(volume)
        await database.dbAsync.run(
          `INSERT INTO chapters (
            id, book_id, volume_id, chapter_index, title, objective, planned_beats_json,
            status, current_plan_version_id, current_version_id, draft_path, final_path,
            approved_at, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          'chapter-1',
          'book-1',
          'volume-1',
          1,
          '暗潮',
          '查明敌营动向',
          JSON.stringify(['潜入据点', '发现密信']),
          'planned',
          null,
          null,
          null,
          null,
          null,
          '2026-04-06T00:00:00.000Z',
          '2026-04-06T00:00:00.000Z',
        )
        await repository.updateChapterIdsAsync('volume-1', ['chapter-1', 'chapter-2'], '2026-04-06T00:20:00.000Z')

        const byId = await repository.getByIdAsync('volume-1')
        const byChapter = await repository.getByChapterIdAsync('chapter-1')
        const list = await repository.listByBookIdAsync('book-1')

        assert.deepEqual(byId?.chapterIds, ['chapter-1', 'chapter-2'])
        assert.equal(byChapter?.id, 'volume-1')
        assert.equal(list.length, 1)
        assert.equal(list[0]?.updatedAt, '2026-04-06T00:20:00.000Z')
      },
    )
  })
})