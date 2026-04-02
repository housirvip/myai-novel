import type { ChapterDraft, LlmAdapter, WriteNextResult, WritingContext } from '../../shared/types/domain.js'
import { createId } from '../../shared/utils/id.js'
import { nowIso } from '../../shared/utils/time.js'
import type { ChapterDraftRepository } from '../../infra/repository/chapter-draft-repository.js'
import type { ChapterRepository } from '../../infra/repository/chapter-repository.js'
import type { WritingContextBuilder } from '../context/writing-context-builder.js'

export class GenerationService {
  constructor(
    private readonly writingContextBuilder: WritingContextBuilder,
    private readonly chapterDraftRepository: ChapterDraftRepository,
    private readonly chapterRepository: ChapterRepository,
    private readonly llmAdapter: LlmAdapter | null,
  ) {}

  async writeNext(chapterId: string): Promise<WriteNextResult> {
    const context = this.writingContextBuilder.build(chapterId)
    const timestamp = nowIso()
    const draft = this.llmAdapter
      ? await createLlmDraft(this.llmAdapter, context, timestamp)
      : createRuleBasedDraft(context, timestamp)

    this.chapterDraftRepository.create(draft)
    this.chapterRepository.markDrafted(chapterId, draft.versionId, undefined, timestamp)

    return {
      chapterId,
      chapterStatus: 'drafted',
      draftId: draft.id,
      actualWordCount: draft.actualWordCount,
      nextAction: 'review',
    }
  }
}

async function createLlmDraft(
  llmAdapter: LlmAdapter,
  context: WritingContext,
  timestamp: string,
): Promise<ChapterDraft> {
  const response = await llmAdapter.generateText({
    system: '你是小说写作助手。请直接输出章节草稿正文，不要解释。',
    user: JSON.stringify(
      {
        bookTitle: context.book.title,
        chapterTitle: context.chapter.title,
        chapterObjective: context.chapter.objective,
        volumeGoal: context.volume.goal,
        theme: context.outline.theme,
        characterStates: context.characterStates.map((state) => ({
          characterId: state.characterId,
          currentLocationId: state.currentLocationId,
          statusNotes: state.statusNotes,
        })),
        activeHookStates: context.activeHookStates,
        hookPlan: context.chapterPlan.hookPlan,
        memoryRecall: context.memoryRecall,
        sceneCards: context.chapterPlan.sceneCards,
        eventOutline: context.chapterPlan.eventOutline,
        importantItems: context.importantItems.map((item) => ({
          id: item.id,
          name: item.name,
          quantity: item.quantity,
          status: item.status,
          ownerCharacterId: item.ownerCharacterId,
          locationId: item.locationId,
        })),
      },
      null,
      2,
    ),
  })

  return {
    id: createId('draft'),
    bookId: context.book.id,
    chapterId: context.chapter.id,
    versionId: createId('draft_version'),
    chapterPlanId: context.chapterPlan.id,
    content: response.text.trim(),
    actualWordCount: estimateWordCount(response.text),
    createdAt: timestamp,
  }
}

function createRuleBasedDraft(context: WritingContext, timestamp: string): ChapterDraft {
  const content = buildDraftContent(context)

  return {
    id: createId('draft'),
    bookId: context.book.id,
    chapterId: context.chapter.id,
    versionId: createId('draft_version'),
    chapterPlanId: context.chapterPlan.id,
    content,
    actualWordCount: estimateWordCount(content),
    createdAt: timestamp,
  }
}

function buildDraftContent(context: WritingContext): string {
  const characterStatesSection = context.characterStates.length > 0
    ? [
        '## 角色当前状态',
        '',
        ...context.characterStates.map(
          (state) =>
            `- 角色（${state.characterId}）：当前位置=${state.currentLocationId ?? '未知'}；状态=${state.statusNotes.join(' / ') || '无'}`,
        ),
        '',
      ]
    : []
  const hookSection = context.chapterPlan.hookPlan.length > 0 || context.activeHookStates.length > 0
    ? [
        '## 钩子约束',
        '',
        ...context.chapterPlan.hookPlan.map((item) => {
          const activeState = context.activeHookStates.find((candidate) => candidate.hookId === item.hookId)

          return `- Hook（${item.hookId}）：动作=${item.action}；当前状态=${activeState?.status ?? 'unknown'}；说明=${item.note}`
        }),
        '',
      ]
    : []
  const sceneSections = context.chapterPlan.sceneCards
    .map((scene, index) => {
      const beats = scene.beats.map((beat) => `- ${beat}`).join('\n')

      return `## 场景 ${index + 1}：${scene.title}\n\n${scene.purpose}\n\n${beats}`
    })
    .join('\n\n')
  const importantItemsSection = context.importantItems.length > 0
    ? [
        '## 关键物品状态',
        '',
        ...context.importantItems.map(
          (item) =>
            `- ${item.name}（${item.id}）：数量=${item.quantity}${item.unit}；状态=${item.status}；持有者=${item.ownerCharacterId ?? '未知'}；地点=${item.locationId ?? '未知'}`,
        ),
        '',
      ]
    : []
  const memorySection =
    context.memoryRecall.shortTermSummaries.length > 0 || context.memoryRecall.relevantLongTermEntries.length > 0
      ? [
          '## 记忆约束',
          '',
          ...context.memoryRecall.shortTermSummaries.map((item) => `- 最近摘要：${item}`),
          ...context.memoryRecall.recentEvents.map((item) => `- 最近事件：${item}`),
          ...context.memoryRecall.relevantLongTermEntries.map((entry) => `- 长期记忆：${entry.summary}`),
          '',
        ]
      : []

  return [
    `# ${context.chapter.title}`,
    '',
    `本章目标：${context.chapter.objective}`,
    `卷目标：${context.volume.goal}`,
    `主题呼应：${context.outline.theme}`,
    '',
    '## 章节草稿',
    '',
    `故事发生在《${context.book.title}》的当前主线推进阶段。`,
    context.previousChapter
      ? `上一章《${context.previousChapter.title}》留下的局势仍在持续发酵。`
      : '这是故事前期的重要起势章节，需要尽快建立主角处境与冲突压力。',
    '',
    ...characterStatesSection,
    ...memorySection,
    ...importantItemsSection,
    ...hookSection,
    sceneSections,
    '',
    '## 本章事件提要',
    '',
    ...context.chapterPlan.eventOutline.map((item) => `- ${item}`),
    '',
    '## 结尾推进',
    '',
    '本章结尾应留下新的局势变化，推动读者进入下一章。',
  ].join('\n')
}

function estimateWordCount(content: string): number {
  return content.replace(/\s+/g, '').length
}
