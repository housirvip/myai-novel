import assert from 'node:assert/strict'
import test from 'node:test'

import { BookRepository } from '../../../../src/infra/repository/book-repository.js'
import { HookRepository } from '../../../../src/infra/repository/hook-repository.js'
import { ChapterHookUpdateRepository } from '../../../../src/infra/repository/chapter-hook-update-repository.js'
import { ChapterMemoryUpdateRepository } from '../../../../src/infra/repository/chapter-memory-update-repository.js'
import { ChapterStateUpdateRepository } from '../../../../src/infra/repository/chapter-state-update-repository.js'
import { createBookFixture } from '../../../helpers/domain-fixtures.js'
import { insertVolumeAndChapter, withSqliteDatabase } from '../../../helpers/sqlite.js'

// 这组测试覆盖 chapter_state_update / memory_update / hook_update 三类“按章追加”的历史记录表。
test('chapter update repositories persist and list updates by chapter/book', async () => {
  await withSqliteDatabase(async (database) => {
    await new BookRepository(database).createAsync(createBookFixture())
    await insertVolumeAndChapter(database, { bookId: 'book-1', volumeId: 'volume-1', chapterId: 'chapter-1' })
    await new HookRepository(database).createAsync({
      id: 'hook-1',
      bookId: 'book-1',
      title: '王城阴谋',
      sourceChapterId: 'chapter-1',
      description: '核心悬念',
      payoffExpectation: '未来回收',
      priority: 'high',
      status: 'open',
      createdAt: '2026-04-06T00:00:00.000Z',
      updatedAt: '2026-04-06T00:00:00.000Z',
    })

    const stateRepository = new ChapterStateUpdateRepository(database)
    const memoryRepository = new ChapterMemoryUpdateRepository(database)
    const hookRepository = new ChapterHookUpdateRepository(database)

    stateRepository.create({
      id: 'state-update-1',
      bookId: 'book-1',
      chapterId: 'chapter-1',
      entityType: 'character',
      entityId: 'character-1',
      summary: '角色状态更新',
      detail: { source: 'structured-text', reason: '角色推进', evidence: ['取得密信'] },
      createdAt: '2026-04-06T00:10:00.000Z',
    })
    await memoryRepository.createAsync({
      id: 'memory-update-1',
      bookId: 'book-1',
      chapterId: 'chapter-1',
      memoryType: 'observation',
      summary: '观察记忆更新',
      detail: { source: 'fallback', reason: '补记观察', evidence: ['守卫增多'] },
      createdAt: '2026-04-06T00:11:00.000Z',
    })
    await hookRepository.createAsync({
      id: 'hook-update-1',
      bookId: 'book-1',
      chapterId: 'chapter-1',
      hookId: 'hook-1',
      status: 'foreshadowed',
      summary: 'hook 推进',
      detail: { source: 'closure-suggestion', reason: '抬高压力', evidence: ['谜团扩张'] },
      createdAt: '2026-04-06T00:12:00.000Z',
    })

    // 这里同时断言按 chapter 和按 book 的查询口径，确保追踪命令能复用同一份历史数据。
    assert.equal(stateRepository.listByChapterId('chapter-1').length, 1)
    assert.equal((await stateRepository.listByBookIdAsync('book-1')).length, 1)
    assert.equal(memoryRepository.listByChapterId('chapter-1')[0]?.memoryType, 'observation')
    assert.equal((await memoryRepository.listByBookIdAsync('book-1')).length, 1)
    assert.equal(hookRepository.listByChapterId('chapter-1')[0]?.status, 'foreshadowed')
    assert.equal((await hookRepository.listByBookIdAsync('book-1')).length, 1)
  })
})
