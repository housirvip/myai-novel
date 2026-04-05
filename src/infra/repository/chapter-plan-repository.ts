import type { ChapterPlan } from '../../shared/types/domain.js'
import type { NovelDatabase } from '../db/database.js'
import { dbAll, dbAllAsync, dbGet, dbGetAsync, dbRun, dbRunAsync } from '../db/db-client.js'

type ChapterPlanRow = {
  id: string
  book_id: string
  chapter_id: string
  version_id: string
  objective: string
  scene_cards_json: string
  scene_goals_json: string
  scene_constraints_json: string
  scene_emotional_targets_json: string
  scene_outcome_checklist_json: string
  required_character_ids_json: string
  required_location_ids_json: string
  required_faction_ids_json: string
  required_item_ids_json: string
  event_outline_json: string
  hook_plan_json: string
  state_predictions_json: string
  memory_candidates_json: string
  high_pressure_hook_ids_json: string
  character_arc_targets_json: string
  debt_carry_targets_json: string
  mission_id: string | null
  thread_focus_json: string
  window_role: string | null
  carry_in_tasks_json: string
  carry_out_tasks_json: string
  ensemble_focus_character_ids_json: string
  subplot_carry_thread_ids_json: string
  ending_drive: string
  must_resolve_debts_json: string
  must_advance_hooks_json: string
  must_preserve_facts_json: string
  created_at: string
  approved_by_user: number
}

export class ChapterPlanRepository {
  constructor(private readonly database: NovelDatabase) {}

  create(plan: ChapterPlan): void {
    dbRun(
      this.database,
      `
        INSERT INTO chapter_plans (
          id,
          book_id,
          chapter_id,
          version_id,
          objective,
          scene_cards_json,
          scene_goals_json,
          scene_constraints_json,
          scene_emotional_targets_json,
          scene_outcome_checklist_json,
          required_character_ids_json,
          required_location_ids_json,
          required_faction_ids_json,
          required_item_ids_json,
          event_outline_json,
          hook_plan_json,
          state_predictions_json,
          memory_candidates_json,
          high_pressure_hook_ids_json,
          character_arc_targets_json,
          debt_carry_targets_json,
          mission_id,
          thread_focus_json,
          window_role,
          carry_in_tasks_json,
          carry_out_tasks_json,
          ensemble_focus_character_ids_json,
          subplot_carry_thread_ids_json,
          ending_drive,
          must_resolve_debts_json,
          must_advance_hooks_json,
          must_preserve_facts_json,
          created_at,
          approved_by_user
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      plan.id,
      plan.bookId,
      plan.chapterId,
      plan.versionId,
      plan.objective,
      JSON.stringify(plan.sceneCards),
      JSON.stringify(plan.sceneGoals),
      JSON.stringify(plan.sceneConstraints),
      JSON.stringify(plan.sceneEmotionalTargets),
      JSON.stringify(plan.sceneOutcomeChecklist),
      JSON.stringify(plan.requiredCharacterIds),
      JSON.stringify(plan.requiredLocationIds),
      JSON.stringify(plan.requiredFactionIds),
      JSON.stringify(plan.requiredItemIds),
      JSON.stringify(plan.eventOutline),
      JSON.stringify(plan.hookPlan),
      JSON.stringify(plan.statePredictions),
      JSON.stringify(plan.memoryCandidates),
      JSON.stringify(plan.highPressureHookIds),
      JSON.stringify(plan.characterArcTargets),
      JSON.stringify(plan.debtCarryTargets),
      plan.missionId ?? null,
      JSON.stringify(plan.threadFocus),
      plan.windowRole ?? null,
      JSON.stringify(plan.carryInTasks),
      JSON.stringify(plan.carryOutTasks),
      JSON.stringify(plan.ensembleFocusCharacterIds),
      JSON.stringify(plan.subplotCarryThreadIds),
      plan.endingDrive,
      JSON.stringify(plan.mustResolveDebts),
      JSON.stringify(plan.mustAdvanceHooks),
      JSON.stringify(plan.mustPreserveFacts),
      plan.createdAt,
      plan.approvedByUser ? 1 : 0,
    )
  }

  async createAsync(plan: ChapterPlan): Promise<void> {
    await dbRunAsync(
      this.database,
      `
        INSERT INTO chapter_plans (
          id,
          book_id,
          chapter_id,
          version_id,
          objective,
          scene_cards_json,
          scene_goals_json,
          scene_constraints_json,
          scene_emotional_targets_json,
          scene_outcome_checklist_json,
          required_character_ids_json,
          required_location_ids_json,
          required_faction_ids_json,
          required_item_ids_json,
          event_outline_json,
          hook_plan_json,
          state_predictions_json,
          memory_candidates_json,
          high_pressure_hook_ids_json,
          character_arc_targets_json,
          debt_carry_targets_json,
          mission_id,
          thread_focus_json,
          window_role,
          carry_in_tasks_json,
          carry_out_tasks_json,
          ensemble_focus_character_ids_json,
          subplot_carry_thread_ids_json,
          ending_drive,
          must_resolve_debts_json,
          must_advance_hooks_json,
          must_preserve_facts_json,
          created_at,
          approved_by_user
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      plan.id,
      plan.bookId,
      plan.chapterId,
      plan.versionId,
      plan.objective,
      JSON.stringify(plan.sceneCards),
      JSON.stringify(plan.sceneGoals),
      JSON.stringify(plan.sceneConstraints),
      JSON.stringify(plan.sceneEmotionalTargets),
      JSON.stringify(plan.sceneOutcomeChecklist),
      JSON.stringify(plan.requiredCharacterIds),
      JSON.stringify(plan.requiredLocationIds),
      JSON.stringify(plan.requiredFactionIds),
      JSON.stringify(plan.requiredItemIds),
      JSON.stringify(plan.eventOutline),
      JSON.stringify(plan.hookPlan),
      JSON.stringify(plan.statePredictions),
      JSON.stringify(plan.memoryCandidates),
      JSON.stringify(plan.highPressureHookIds),
      JSON.stringify(plan.characterArcTargets),
      JSON.stringify(plan.debtCarryTargets),
      plan.missionId ?? null,
      JSON.stringify(plan.threadFocus),
      plan.windowRole ?? null,
      JSON.stringify(plan.carryInTasks),
      JSON.stringify(plan.carryOutTasks),
      JSON.stringify(plan.ensembleFocusCharacterIds),
      JSON.stringify(plan.subplotCarryThreadIds),
      plan.endingDrive,
      JSON.stringify(plan.mustResolveDebts),
      JSON.stringify(plan.mustAdvanceHooks),
      JSON.stringify(plan.mustPreserveFacts),
      plan.createdAt,
      plan.approvedByUser ? 1 : 0,
    )
  }

  getLatestByChapterId(chapterId: string): ChapterPlan | null {
    const row = dbGet<ChapterPlanRow>(
      this.database,
      `
        SELECT *
        FROM chapter_plans
        WHERE chapter_id = ?
        ORDER BY created_at DESC
        LIMIT 1
      `,
      chapterId,
    )

    return row ? mapChapterPlan(row) : null
  }

  async getLatestByChapterIdAsync(chapterId: string): Promise<ChapterPlan | null> {
    const row = await dbGetAsync<ChapterPlanRow>(
      this.database,
      `
        SELECT *
        FROM chapter_plans
        WHERE chapter_id = ?
        ORDER BY created_at DESC
        LIMIT 1
      `,
      chapterId,
    )

    return row ? mapChapterPlan(row) : null
  }

  getByVersionId(chapterId: string, versionId: string): ChapterPlan | null {
    const row = dbGet<ChapterPlanRow>(
      this.database,
      `
        SELECT *
        FROM chapter_plans
        WHERE chapter_id = ? AND version_id = ?
        LIMIT 1
      `,
      chapterId,
      versionId,
    )

    return row ? mapChapterPlan(row) : null
  }

  async getByVersionIdAsync(chapterId: string, versionId: string): Promise<ChapterPlan | null> {
    const row = await dbGetAsync<ChapterPlanRow>(
      this.database,
      `
        SELECT *
        FROM chapter_plans
        WHERE chapter_id = ? AND version_id = ?
        LIMIT 1
      `,
      chapterId,
      versionId,
    )

    return row ? mapChapterPlan(row) : null
  }

  listByChapterId(chapterId: string): ChapterPlan[] {
    const rows = dbAll<ChapterPlanRow>(
      this.database,
      `
        SELECT *
        FROM chapter_plans
        WHERE chapter_id = ?
        ORDER BY created_at DESC
      `,
      chapterId,
    )

    return rows.map(mapChapterPlan)
  }

  async listByChapterIdAsync(chapterId: string): Promise<ChapterPlan[]> {
    const rows = await dbAllAsync<ChapterPlanRow>(
      this.database,
      `
        SELECT *
        FROM chapter_plans
        WHERE chapter_id = ?
        ORDER BY created_at DESC
      `,
      chapterId,
    )

    return rows.map(mapChapterPlan)
  }
}

function mapChapterPlan(row: ChapterPlanRow): ChapterPlan {
  return {
    id: row.id,
    bookId: row.book_id,
    chapterId: row.chapter_id,
    versionId: row.version_id,
    objective: row.objective,
    sceneCards: JSON.parse(row.scene_cards_json) as ChapterPlan['sceneCards'],
    sceneGoals: JSON.parse(row.scene_goals_json) as ChapterPlan['sceneGoals'],
    sceneConstraints: JSON.parse(row.scene_constraints_json) as ChapterPlan['sceneConstraints'],
    sceneEmotionalTargets: JSON.parse(row.scene_emotional_targets_json) as ChapterPlan['sceneEmotionalTargets'],
    sceneOutcomeChecklist: JSON.parse(row.scene_outcome_checklist_json) as ChapterPlan['sceneOutcomeChecklist'],
    requiredCharacterIds: JSON.parse(row.required_character_ids_json) as string[],
    requiredLocationIds: JSON.parse(row.required_location_ids_json) as string[],
    requiredFactionIds: JSON.parse(row.required_faction_ids_json) as string[],
    requiredItemIds: JSON.parse(row.required_item_ids_json) as string[],
    eventOutline: JSON.parse(row.event_outline_json) as string[],
    hookPlan: JSON.parse(row.hook_plan_json) as ChapterPlan['hookPlan'],
    statePredictions: JSON.parse(row.state_predictions_json) as string[],
    memoryCandidates: JSON.parse(row.memory_candidates_json) as string[],
    highPressureHookIds: JSON.parse(row.high_pressure_hook_ids_json) as string[],
    characterArcTargets: JSON.parse(row.character_arc_targets_json) as string[],
    debtCarryTargets: JSON.parse(row.debt_carry_targets_json) as string[],
    missionId: row.mission_id ?? undefined,
    threadFocus: JSON.parse(row.thread_focus_json) as string[],
    windowRole: row.window_role ?? undefined,
    carryInTasks: JSON.parse(row.carry_in_tasks_json) as string[],
    carryOutTasks: JSON.parse(row.carry_out_tasks_json) as string[],
    ensembleFocusCharacterIds: JSON.parse(row.ensemble_focus_character_ids_json) as string[],
    subplotCarryThreadIds: JSON.parse(row.subplot_carry_thread_ids_json) as string[],
    endingDrive: row.ending_drive,
    mustResolveDebts: JSON.parse(row.must_resolve_debts_json) as string[],
    mustAdvanceHooks: JSON.parse(row.must_advance_hooks_json) as string[],
    mustPreserveFacts: JSON.parse(row.must_preserve_facts_json) as string[],
    createdAt: row.created_at,
    approvedByUser: row.approved_by_user === 1,
  }
}
