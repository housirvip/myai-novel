import assert from 'node:assert/strict'
import test from 'node:test'

import { BookRepository } from '../../../../src/infra/repository/book-repository.js'
import { VolumePlanRepository } from '../../../../src/infra/repository/volume-plan-repository.js'
import { withEnv } from '../../../helpers/env.js'
import { createBookFixture, createVolumePlanFixture } from '../../../helpers/domain-fixtures.js'
import { insertVolumeAndChapter, withSqliteDatabase } from '../../../helpers/sqlite.js'

const resetLlmEnv = {
  LLM_PROVIDER: undefined,
  OPENAI_API_KEY: undefined,
  OPENAI_MODEL: undefined,
  OPENAI_COMPATIBLE_API_KEY: undefined,
  OPENAI_COMPATIBLE_MODEL: undefined,
} satisfies Record<string, string | undefined>

// volume_plan 是卷级版本表，latest 选择依赖 updatedAt 而不是 createdAt。
test('VolumePlanRepository persists volume plans and resolves latest ordering by updatedAt', async () => {
  await withSqliteDatabase(async (database) => {
    await withEnv(
      {
        ...resetLlmEnv,
        LLM_PROVIDER: 'openai',
        OPENAI_MODEL: 'gpt-openai',
      },
      async () => {
        await new BookRepository(database).createAsync(createBookFixture())
        await insertVolumeAndChapter(database, { bookId: 'book-1', volumeId: 'volume-1', chapterId: 'chapter-1' })

        const repository = new VolumePlanRepository(database)
        const first = createVolumePlanFixture()
        const second = createVolumePlanFixture({
          id: 'volume-plan-2',
          title: '第一卷滚动窗口计划（更新版）',
          updatedAt: '2026-04-06T00:30:00.000Z',
        })

        await repository.createAsync(first)
        await repository.createAsync(second)

        // 更新版 updatedAt 更晚，应覆盖为当前卷窗口的 latest 计划。
        const latest = await repository.getLatestByVolumeIdAsync('volume-1')
        const list = await repository.listByVolumeIdAsync('volume-1')

        assert.equal(latest?.id, 'volume-plan-2')
        assert.equal(latest?.title, '第一卷滚动窗口计划（更新版）')
        assert.deepEqual(latest?.rollingWindow, second.rollingWindow)
        assert.deepEqual(list.map((item) => item.id), ['volume-plan-2', 'volume-plan-1'])
      },
    )
  })
})
