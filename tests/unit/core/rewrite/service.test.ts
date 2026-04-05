import assert from 'node:assert/strict'
import test from 'node:test'

import type {
  ClosureSuggestions,
  ReviewReport,
  RewriteQualityTarget,
  RewriteRequest,
  RewriteStrategyProfile,
} from '../../../../src/shared/types/domain.js'
import { __rewriteServiceTestables } from '../../../../src/core/rewrite/service.js'

const baseClosureSuggestions = (): ClosureSuggestions => ({
  characters: [],
  items: [],
  hooks: [],
  memory: [],
})

const baseReview = (overrides?: Partial<ReviewReport>): ReviewReport => ({
  id: 'review-1',
  bookId: 'book-1',
  chapterId: 'chapter-1',
  draftId: 'draft-1',
  decision: 'warning',
  consistencyIssues: [],
  characterIssues: [],
  itemIssues: [],
  memoryIssues: [],
  pacingIssues: [],
  hookIssues: [],
  threadIssues: [],
  endingReadinessIssues: [],
  missionProgress: {
    status: 'completed',
    evidence: [],
  },
  reviewLayers: {
    mustFix: [],
    narrativeQuality: [],
    languageQuality: [],
    rewriteStrategySuggestion: {
      primary: 'pacing-first',
      secondary: ['consistency-first'],
      rationale: ['基础节奏问题需要优先修正。'],
    },
  },
  approvalRisk: 'medium',
  wordCountCheck: {
    target: 2000,
    actual: 1900,
    toleranceRatio: 0.2,
    deviationRatio: 0.05,
    passed: true,
  },
  newFactCandidates: [],
  closureSuggestions: baseClosureSuggestions(),
  outcomeCandidate: {
    decision: 'warning',
    resolvedFacts: [],
    observationFacts: [],
    contradictions: [],
    narrativeDebts: [],
    characterArcProgress: [],
    hookDebtUpdates: [],
  },
  revisionAdvice: ['补强结尾推进'],
  createdAt: '2026-04-06T00:00:00.000Z',
  ...overrides,
})

const baseRewriteContext = () => ({
  sceneCards: [],
  eventOutline: [],
  statePredictions: [],
  hookPlan: [],
  missionId: undefined,
  threadFocus: [],
  windowRole: undefined,
  carryInTasks: [],
  carryOutTasks: [],
  ensembleFocusCharacterIds: [],
  subplotCarryThreadIds: [],
  endingDrive: '',
  characterStates: [],
  importantItems: [],
  activeHookStates: [],
  shortTermMemory: [],
  recentEvents: [],
  observationEntries: [],
  relevantLongTermEntries: [],
})

test('summarizeRewriteContext returns fallback guidance when no contextual signals exist', () => {
  const summary = __rewriteServiceTestables.summarizeRewriteContext(baseRewriteContext())

  assert.deepEqual(summary, ['保持 chapter plan、卷级 mission 与当前状态约束一致'])
})

test('resolveRewriteStrategyProfile prefers manual dialogue goals over review defaults', () => {
  const strategy = __rewriteServiceTestables.resolveRewriteStrategyProfile(
    baseReview(),
    ['增强对话张力'],
    baseRewriteContext(),
  )

  assert.equal(strategy.primary, 'dialogue-enhance')
  assert.equal(strategy.source, 'manual-goals')
  assert.ok(strategy.secondary.includes('pacing-first'))
  assert.match(strategy.rationale.join(' '), /对话/)
})

test('resolveRewriteStrategyProfile switches to closure-focus when volume closure signals are strong', () => {
  const strategy = __rewriteServiceTestables.resolveRewriteStrategyProfile(
    baseReview(),
    [],
    {
      ...baseRewriteContext(),
      endingDrive: '结局前置牵引',
      carryOutTasks: ['为终局埋下收束点'],
    },
  )

  assert.equal(strategy.primary, 'closure-focus')
  assert.ok(strategy.secondary.includes('ending-drive-first'))
  assert.match(strategy.rationale.join(' '), /收束|结尾牵引/)
})

test('buildRewriteQualityTarget derives issue reduction and focus areas from review layers and volume signals', () => {
  const request: RewriteRequest = {
    chapterId: 'chapter-1',
    strategy: 'partial',
    goals: ['补强结尾'],
    preserveFacts: true,
    preserveHooks: true,
    preserveEndingBeat: true,
  }
  const strategyProfile: RewriteStrategyProfile = {
    primary: 'closure-focus',
    secondary: ['ending-drive-first'],
    source: 'review-layers',
    rationale: ['当前章需要优先补强收束。'],
  }
  const qualityTarget: RewriteQualityTarget = __rewriteServiceTestables.buildRewriteQualityTarget(
    request,
    baseReview({
      reviewLayers: {
        mustFix: [{ category: 'consistency', severity: 'critical', summary: '关键事实冲突' }],
        narrativeQuality: [{ category: 'ending-drive', severity: 'high', summary: '结尾牵引不足' }],
        languageQuality: [{ category: 'style', severity: 'low', summary: '对话还可以更紧凑' }],
        rewriteStrategySuggestion: {
          primary: 'closure-focus',
          secondary: ['ending-drive-first'],
          rationale: ['需要优先补强收束。'],
        },
      },
    }),
    strategyProfile,
    {
      ...baseRewriteContext(),
      missionId: 'mission-1',
      carryOutTasks: ['回收支线'],
      endingDrive: '结局前置牵引',
    },
  )

  assert.equal(qualityTarget.targetIssueReduction, 75)
  assert.ok(qualityTarget.focusAreas.includes('closure-focus'))
  assert.ok(qualityTarget.focusAreas.some((item) => item.includes('mission:mission-1')))
  assert.ok(qualityTarget.focusAreas.some((item) => item.includes('ending-drive:结局前置牵引')))
})

test('validateRewrite computes closure preservation and targeted issue types', () => {
  const validation = __rewriteServiceTestables.validateRewrite(
    {
      decision: 'warning',
      approvalRisk: 'medium',
      consistencyIssues: ['设定冲突'],
      characterIssues: ['角色状态偏移'],
      itemIssues: [],
      memoryIssues: [],
      pacingIssues: ['节奏偏慢'],
      hookIssues: ['Hook 未推进'],
      closureSuggestions: {
        characters: [
          {
            characterId: 'hero-1',
            nextLocationId: 'tower',
            nextStatusNotes: ['觉醒'],
            reason: '角色状态已确认',
            evidence: ['角色（hero-1）'],
            source: 'rule-based',
          },
        ],
        items: [],
        hooks: [],
        memory: [],
      },
    },
    '## 重写说明\n角色 hero-1 在 tower 完成觉醒，并处理了 consistency 与 pacing 问题。',
    {
      primary: 'consistency-first',
      secondary: ['pacing-first'],
      source: 'review-layers',
      rationale: ['先修一致性，再修节奏。'],
    },
  )

  assert.equal(validation.issueCount, 4)
  assert.equal(validation.preservedClosureScore, 100)
  assert.equal(validation.strategyAligned, true)
  assert.ok(validation.targetedIssueTypes.includes('consistency'))
  assert.ok(validation.targetedIssueTypes.includes('state'))
  assert.ok(validation.targetedIssueTypes.includes('hook'))
})