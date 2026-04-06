import assert from 'node:assert/strict'
import test from 'node:test'

import { BookRepository } from '../../../../src/infra/repository/book-repository.js'
import { ChapterOutcomeRepository } from '../../../../src/infra/repository/chapter-outcome-repository.js'
import { CharacterRepository } from '../../../../src/infra/repository/character-repository.js'
import { HookRepository } from '../../../../src/infra/repository/hook-repository.js'
import { ItemCurrentStateRepository } from '../../../../src/infra/repository/item-current-state-repository.js'
import { ItemRepository } from '../../../../src/infra/repository/item-repository.js'
import { LocationRepository } from '../../../../src/infra/repository/location-repository.js'
import { MemoryRepository } from '../../../../src/infra/repository/memory-repository.js'
import { NarrativeDebtRepository } from '../../../../src/infra/repository/narrative-debt-repository.js'
import { createBookFixture } from '../../../helpers/domain-fixtures.js'
import { insertVolumeAndChapter, withSqliteDatabase } from '../../../helpers/sqlite.js'

test('character/location/item/hook repositories persist and list domain entities', async () => {
  await withSqliteDatabase(async (database) => {
    await new BookRepository(database).createAsync(createBookFixture())
    await insertVolumeAndChapter(database, { bookId: 'book-1', volumeId: 'volume-1', chapterId: 'chapter-1' })

    const characterRepository = new CharacterRepository(database)
    const locationRepository = new LocationRepository(database)
    const itemRepository = new ItemRepository(database)
    const hookRepository = new HookRepository(database)

    characterRepository.create({
      id: 'character-1',
      bookId: 'book-1',
      name: '林泽',
      role: '主角',
      profile: '谨慎',
      motivation: '查明真相',
      createdAt: '2026-04-06T00:00:00.000Z',
      updatedAt: '2026-04-06T00:00:00.000Z',
    })
    await locationRepository.createAsync({
      id: 'location-1',
      bookId: 'book-1',
      name: '王城',
      type: 'city',
      description: '主舞台',
      createdAt: '2026-04-06T00:00:00.000Z',
      updatedAt: '2026-04-06T00:00:00.000Z',
    })
    await itemRepository.createAsync({
      id: 'item-1',
      bookId: 'book-1',
      name: '密信',
      unit: '封',
      type: 'document',
      isUniqueWorldwide: true,
      isImportant: true,
      description: '关键线索',
      createdAt: '2026-04-06T00:00:00.000Z',
      updatedAt: '2026-04-06T00:00:00.000Z',
    })
    await hookRepository.createAsync({
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

    assert.equal(characterRepository.getById('character-1')?.name, '林泽')
    assert.equal((await characterRepository.getPrimaryByBookIdAsync('book-1'))?.id, 'character-1')
    assert.equal(characterRepository.listByBookId('book-1').length, 1)

    assert.equal(locationRepository.getById('location-1')?.name, '王城')
    assert.equal((await locationRepository.listByBookIdAsync('book-1')).length, 1)

    assert.equal(itemRepository.getById('item-1')?.name, '密信')
    assert.equal((await itemRepository.listByBookIdAsync('book-1')).length, 1)

    assert.equal(hookRepository.listByBookId('book-1')[0]?.title, '王城阴谋')
    assert.equal((await hookRepository.listByBookIdAsync('book-1')).length, 1)
  })
})

test('item current state, memory and narrative debt repositories persist stateful domain data', async () => {
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
    await new ItemRepository(database).createAsync({
      id: 'item-1',
      bookId: 'book-1',
      name: '密信',
      unit: '封',
      type: 'document',
      isUniqueWorldwide: true,
      isImportant: true,
      description: '关键线索',
      createdAt: '2026-04-06T00:00:00.000Z',
      updatedAt: '2026-04-06T00:00:00.000Z',
    })

    const itemStateRepository = new ItemCurrentStateRepository(database)
    const memoryRepository = new MemoryRepository(database)
    const debtRepository = new NarrativeDebtRepository(database)
    const outcomeRepository = new ChapterOutcomeRepository(database)

    itemStateRepository.upsert({
      bookId: 'book-1',
      itemId: 'item-1',
      ownerCharacterId: 'character-1',
      locationId: 'location-1',
      quantity: 1,
      status: '随身携带',
      updatedAt: '2026-04-06T00:10:00.000Z',
    })

    memoryRepository.upsertShortTerm({
      bookId: 'book-1',
      chapterId: 'chapter-1',
      summaries: ['潜入成功'],
      recentEvents: ['取得密信'],
      updatedAt: '2026-04-06T00:10:00.000Z',
    })
    await memoryRepository.upsertObservationAsync({
      bookId: 'book-1',
      chapterId: 'chapter-1',
      entries: [{ summary: '守卫异常增多', sourceChapterId: 'chapter-1' }],
      updatedAt: '2026-04-06T00:11:00.000Z',
    })
    await memoryRepository.upsertLongTermAsync({
      bookId: 'book-1',
      chapterId: 'chapter-1',
      entries: [{ summary: '王城阴谋已被确认存在', importance: 9, sourceChapterId: 'chapter-1' }],
      updatedAt: '2026-04-06T00:12:00.000Z',
    })

    await outcomeRepository.createAsync({
      id: 'outcome-1',
      bookId: 'book-1',
      chapterId: 'chapter-1',
      decision: 'warning',
      resolvedFacts: [],
      observationFacts: [],
      contradictions: [],
      narrativeDebts: [],
      characterArcProgress: [],
      hookDebtUpdates: [],
      createdAt: '2026-04-06T00:13:00.000Z',
    })
    await debtRepository.createBatchAsync([
      {
        id: 'debt-1',
        bookId: 'book-1',
        chapterId: 'chapter-1',
        outcomeId: 'outcome-1',
        debtType: 'hook',
        summary: '后续需要解释密信来源',
        priority: 'high',
        status: 'open',
        createdAt: '2026-04-06T00:14:00.000Z',
      },
    ])

    assert.equal(itemStateRepository.getByItemId('book-1', 'item-1')?.ownerCharacterId, 'character-1')
    assert.equal(itemStateRepository.listImportantByBookId('book-1')[0]?.status, '随身携带')
    assert.equal((await itemStateRepository.getByItemIdAsync('book-1', 'item-1'))?.quantity, 1)
    assert.equal((await itemStateRepository.listImportantByBookIdAsync('book-1')).length, 1)

    assert.equal(memoryRepository.getShortTermByBookId('book-1')?.chapterId, 'chapter-1')
    assert.equal((await memoryRepository.getObservationByBookIdAsync('book-1'))?.entries.length, 1)
    assert.equal((await memoryRepository.getLongTermByBookIdAsync('book-1'))?.entries[0]?.importance, 9)
    assert.deepEqual(memoryRepository.recallRelevantLongTermEntries('book-1', ['王城 阴谋', '确认'], 1), [
      { summary: '王城阴谋已被确认存在', importance: 9, sourceChapterId: 'chapter-1' },
    ])
    assert.deepEqual(await memoryRepository.recallRelevantLongTermEntriesAsync('book-1', ['阴谋'], 2), [
      { summary: '王城阴谋已被确认存在', importance: 9, sourceChapterId: 'chapter-1' },
    ])
    assert.deepEqual(memoryRepository.recallRelevantLongTermEntries('missing-book', ['阴谋']), [])

    assert.equal(debtRepository.listByChapterId('chapter-1')[0]?.id, 'debt-1')
    assert.equal((await debtRepository.listOpenByBookIdAsync('book-1')).length, 1)

    debtRepository.resolveByIds(['debt-1'], '2026-04-06T00:20:00.000Z')
    assert.equal(debtRepository.listOpenByBookId('book-1').length, 0)
  })
})

test('item current state falls back to defaults for important items without persisted state', async () => {
  await withSqliteDatabase(async (database) => {
    await new BookRepository(database).createAsync(createBookFixture())
    await new ItemRepository(database).createAsync({
      id: 'item-2',
      bookId: 'book-1',
      name: '古卷',
      unit: '册',
      type: 'artifact',
      isUniqueWorldwide: false,
      isImportant: true,
      description: '未登记状态的重要道具',
      createdAt: '2026-04-06T00:00:00.000Z',
      updatedAt: '2026-04-06T00:00:00.000Z',
    })

    const views = new ItemCurrentStateRepository(database).listImportantByBookId('book-1')
    assert.equal(views[0]?.quantity, 1)
    assert.equal(views[0]?.status, '未记录')
    assert.equal(views[0]?.updatedAt, '')
  })
})