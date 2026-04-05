import assert from 'node:assert/strict'
import test from 'node:test'

import type { ClosureSuggestions, ReviewReport, WordCountCheck } from '../../../../src/shared/types/domain.js'
import { __reviewServiceTestables } from '../../../../src/core/review/service.js'

const baseClosureSuggestions = (): ClosureSuggestions => ({
  characters: [],
  items: [],
  hooks: [],
  memory: [],
})

const baseWordCountCheck = (): WordCountCheck => ({
  target: 2000,
  actual: 2000,
  toleranceRatio: 0.2,
  deviationRatio: 0,
  passed: true,
})

test('createWordCountCheck calculates deviation ratio and pass status', () => {
  const passed = __reviewServiceTestables.createWordCountCheck(2000, 2200, 0.2)
  const failed = __reviewServiceTestables.createWordCountCheck(2000, 2600, 0.2)

  assert.equal(passed.deviationRatio, 0.1)
  assert.equal(passed.passed, true)
  assert.equal(failed.deviationRatio, 0.3)
  assert.equal(failed.passed, false)
})

test('evaluateMissionProgress distinguishes completed, partial and not-applicable missions', () => {
  const completed = __reviewServiceTestables.evaluateMissionProgress(
    {
      missionId: 'mission-1',
      threadFocus: ['thread-A'],
      eventOutline: ['事件推进'],
      carryInTasks: ['承接前情'],
      carryOutTasks: ['抛出后续'],
    },
    '正文承接 thread-A，并完成事件推进，还抛出后续。',
  )
  const partial = __reviewServiceTestables.evaluateMissionProgress(
    {
      missionId: 'mission-2',
      threadFocus: ['thread-B'],
      eventOutline: ['事件B'],
      carryInTasks: ['承接B'],
      carryOutTasks: ['后续B'],
    },
    '正文只出现了 thread-B。',
  )
  const notApplicable = __reviewServiceTestables.evaluateMissionProgress(
    {
      threadFocus: ['thread-C'],
      eventOutline: ['事件C'],
      carryInTasks: [],
      carryOutTasks: [],
    },
    '任意正文',
  )

  assert.equal(completed.status, 'completed')
  assert.deepEqual(completed.evidence, ['thread-A', '事件推进', '抛出后续'])
  assert.equal(partial.status, 'partial')
  assert.deepEqual(partial.evidence, ['thread-B'])
  assert.equal(notApplicable.status, 'not-applicable')
  assert.deepEqual(notApplicable.evidence, [])
})

test('mergeMissionIssues creates clear warnings for partial and missing mission progress', () => {
  const partial = __reviewServiceTestables.mergeMissionIssues(
    { missionId: 'mission-1', carryInTasks: ['承接前情'], carryOutTasks: ['抛出后续'] },
    { missionId: 'mission-1', missionSummary: '承接前情', status: 'partial', evidence: ['thread-A'] },
  )
  const missing = __reviewServiceTestables.mergeMissionIssues(
    { missionId: 'mission-2', carryInTasks: [], carryOutTasks: ['收束线索'] },
    { missionId: 'mission-2', missionSummary: '收束线索', status: 'missing', evidence: [] },
  )

  assert.deepEqual(partial, ['卷级 mission 承接不足：承接前情'])
  assert.deepEqual(missing, ['卷级 mission 未得到有效推进：收束线索'])
})

test('normalizeClosureSuggestions filters invalid entities and fills default semantic fields', () => {
  const normalized = __reviewServiceTestables.normalizeClosureSuggestions(
    {
      characters: [
        {
          characterId: ' hero-1 ',
          nextLocationId: ' tower ',
          nextStatusNotes: ['觉醒', '  '],
          reason: '状态变化',
          evidence: ['证据一'],
        },
        {
          characterId: '   ',
        },
      ],
      items: [
        {
          itemId: 'item-1',
          nextQuantity: 2,
          nextStatus: '已激活',
          reason: '物品被使用',
          evidence: ['证据二'],
        },
      ],
      hooks: [
        {
          hookId: 'hook-1',
          nextStatus: 'invalid-status',
          actualOutcome: 'advance',
          reason: '推进 hook',
          evidence: ['证据三'],
        },
      ],
      memory: [
        {
          summary: ' 新事实 ',
          memoryScope: 'invalid-scope',
          reason: '记忆沉淀',
          evidence: ['证据四'],
        },
      ],
    },
    'llm',
  )

  assert.equal(normalized.characters.length, 1)
  assert.deepEqual(normalized.characters[0], {
    characterId: 'hero-1',
    nextLocationId: 'tower',
    nextStatusNotes: ['觉醒'],
    reason: '状态变化',
    evidence: ['证据一'],
    source: 'llm',
  })
  assert.equal(normalized.items[0]?.nextQuantity, 2)
  assert.equal(normalized.hooks[0]?.nextStatus, 'open')
  assert.equal(normalized.memory[0]?.memoryScope, 'observation')
})

test('buildReviewLayers derives rewrite strategy from hard issues and mission signals', () => {
  const consistencyFirst = __reviewServiceTestables.buildReviewLayers({
    wordCountCheck: baseWordCountCheck(),
    consistencyIssues: ['设定冲突'],
    characterIssues: [],
    itemIssues: [],
    memoryIssues: [],
    pacingIssues: ['情绪推进不足'],
    hookIssues: ['结尾牵引不足'],
    threadIssues: [],
    endingReadinessIssues: [],
    missionProgress: { status: 'completed', evidence: ['thread-A'], missionId: 'mission-1', missionSummary: '推进主线' },
    revisionAdvice: ['需要补一段对话润色'],
  })

  const threadFocus = __reviewServiceTestables.buildReviewLayers({
    wordCountCheck: baseWordCountCheck(),
    consistencyIssues: [],
    characterIssues: [],
    itemIssues: [],
    memoryIssues: [],
    pacingIssues: [],
    hookIssues: [],
    threadIssues: ['高优先级线程 thread-B 本章未形成明确承接。'],
    endingReadinessIssues: [],
    missionProgress: { status: 'missing', evidence: [], missionId: 'mission-2', missionSummary: '推进支线' },
    revisionAdvice: [],
  })

  assert.equal(consistencyFirst.rewriteStrategySuggestion.primary, 'consistency-first')
  assert.ok(consistencyFirst.narrativeQuality.some((item) => item.category === 'ending-drive'))
  assert.ok(consistencyFirst.languageQuality.some((item) => item.category === 'style'))

  assert.equal(threadFocus.rewriteStrategySuggestion.primary, 'thread-focus')
  assert.match(threadFocus.rewriteStrategySuggestion.rationale.join(' '), /mission|线程/)
})