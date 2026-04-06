import assert from 'node:assert/strict'
import test from 'node:test'

import { BookRepository } from '../../../../src/infra/repository/book-repository.js'
import { CharacterRepository } from '../../../../src/infra/repository/character-repository.js'
import { LocationRepository } from '../../../../src/infra/repository/location-repository.js'
import { HookRepository } from '../../../../src/infra/repository/hook-repository.js'
import { CharacterCurrentStateRepository } from '../../../../src/infra/repository/character-current-state-repository.js'
import { CharacterArcRepository } from '../../../../src/infra/repository/character-arc-repository.js'
import { HookStateRepository } from '../../../../src/infra/repository/hook-state-repository.js'
import { HookPressureRepository } from '../../../../src/infra/repository/hook-pressure-repository.js'
import { createBookFixture } from '../../../helpers/domain-fixtures.js'
import { insertVolumeAndChapter, withSqliteDatabase } from '../../../helpers/sqlite.js'

test('stateful repositories persist and query character/hook current state', async () => {
  await withSqliteDatabase(async (database) => {
    await new BookRepository(database).createAsync(createBookFixture())
    await insertVolumeAndChapter(database, { bookId: 'book-1', volumeId: 'volume-1', chapterId: 'chapter-1' })
    await new CharacterRepository(database).createAsync({
      id: 'character-1',
      bookId: 'book-1',
      name: '林泽',
      role: '主角',
      profile: '谨慎',
      motivation: '查明真相',
      createdAt: '2026-04-06T00:00:00.000Z',
      updatedAt: '2026-04-06T00:00:00.000Z',
    })
    await new LocationRepository(database).createAsync({
      id: 'location-1',
      bookId: 'book-1',
      name: '王城',
      type: 'city',
      description: '主舞台',
      createdAt: '2026-04-06T00:00:00.000Z',
      updatedAt: '2026-04-06T00:00:00.000Z',
    })
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

    const characterStateRepository = new CharacterCurrentStateRepository(database)
    const characterArcRepository = new CharacterArcRepository(database)
    const hookStateRepository = new HookStateRepository(database)
    const hookPressureRepository = new HookPressureRepository(database)

    characterStateRepository.upsert({
      bookId: 'book-1',
      characterId: 'character-1',
      currentLocationId: 'location-1',
      statusNotes: ['保持潜伏'],
      updatedAt: '2026-04-06T00:10:00.000Z',
    })
    await characterArcRepository.upsertAsync({
      bookId: 'book-1',
      characterId: 'character-1',
      arc: '成长',
      currentStage: 'rising',
      updatedByChapterId: 'chapter-1',
      summary: '开始怀疑局势',
      updatedAt: '2026-04-06T00:10:00.000Z',
    })
    hookStateRepository.upsertBatch([
      {
        bookId: 'book-1',
        hookId: 'hook-1',
        status: 'foreshadowed',
        updatedByChapterId: 'chapter-1',
        updatedAt: '2026-04-06T00:11:00.000Z',
      },
    ])
    await hookPressureRepository.upsertAsync({
      bookId: 'book-1',
      hookId: 'hook-1',
      pressureScore: 85,
      riskLevel: 'high',
      lastAdvancedChapterId: 'chapter-1',
      nextSuggestedChapterIndex: 2,
      updatedAt: '2026-04-06T00:12:00.000Z',
    })

    assert.equal(characterStateRepository.getByCharacterId('book-1', 'character-1')?.currentLocationId, 'location-1')
    assert.equal((await characterStateRepository.listByBookIdAsync('book-1')).length, 1)
    assert.equal(characterArcRepository.getByCharacterId('book-1', 'character-1')[0]?.currentStage, 'rising')
    assert.equal((await characterArcRepository.listByBookIdAsync('book-1')).length, 1)
    assert.equal(hookStateRepository.listActiveByBookId('book-1')[0]?.status, 'foreshadowed')
    assert.equal((await hookStateRepository.listByBookIdAsync('book-1')).length, 1)
    assert.equal(hookPressureRepository.getByHookId('book-1', 'hook-1')?.pressureScore, 85)
    assert.equal((await hookPressureRepository.listActiveByBookIdAsync('book-1')).length, 1)

    hookPressureRepository.upsert({
      bookId: 'book-1',
      hookId: 'hook-1',
      pressureScore: 70,
      riskLevel: 'medium',
      updatedAt: '2026-04-06T00:13:00.000Z',
    })
    assert.equal((await hookPressureRepository.getByHookIdAsync('book-1', 'hook-1'))?.riskLevel, 'medium')

    await new HookRepository(database).createAsync({
      id: 'hook-2',
      bookId: 'book-1',
      title: '第二谜团',
      sourceChapterId: 'chapter-1',
      description: '次级悬念',
      payoffExpectation: '未来揭晓',
      priority: 'medium',
      status: 'open',
      createdAt: '2026-04-06T00:00:00.000Z',
      updatedAt: '2026-04-06T00:00:00.000Z',
    })
    await hookPressureRepository.upsertAsync({
      bookId: 'book-1',
      hookId: 'hook-2',
      pressureScore: 95,
      riskLevel: 'high',
      updatedAt: '2026-04-06T00:14:00.000Z',
    })

    const ordered = hookPressureRepository.listActiveByBookId('book-1')
    assert.equal(ordered[0]?.hookId, 'hook-2')
  })
})