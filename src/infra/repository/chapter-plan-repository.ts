import type { ChapterPlan } from '../../shared/types/domain.js'
import type { NovelDatabase } from '../db/database.js'

type ChapterPlanRow = {
  id: string
  book_id: string
  chapter_id: string
  version_id: string
  objective: string
  scene_cards_json: string
  required_character_ids_json: string
  required_location_ids_json: string
  required_faction_ids_json: string
  required_item_ids_json: string
  event_outline_json: string
  hook_plan_json: string
  state_predictions_json: string
  memory_candidates_json: string
  created_at: string
  approved_by_user: number
}

export class ChapterPlanRepository {
  constructor(private readonly database: NovelDatabase) {}

  create(plan: ChapterPlan): void {
    this.database
      .prepare(
        `
          INSERT INTO chapter_plans (
            id,
            book_id,
            chapter_id,
            version_id,
            objective,
            scene_cards_json,
            required_character_ids_json,
            required_location_ids_json,
            required_faction_ids_json,
            required_item_ids_json,
            event_outline_json,
            hook_plan_json,
            state_predictions_json,
            memory_candidates_json,
            created_at,
            approved_by_user
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      )
      .run(
        plan.id,
        plan.bookId,
        plan.chapterId,
        plan.versionId,
        plan.objective,
        JSON.stringify(plan.sceneCards),
        JSON.stringify(plan.requiredCharacterIds),
        JSON.stringify(plan.requiredLocationIds),
        JSON.stringify(plan.requiredFactionIds),
        JSON.stringify(plan.requiredItemIds),
        JSON.stringify(plan.eventOutline),
        JSON.stringify(plan.hookPlan),
        JSON.stringify(plan.statePredictions),
        JSON.stringify(plan.memoryCandidates),
        plan.createdAt,
        plan.approvedByUser ? 1 : 0,
      )
  }

  getLatestByChapterId(chapterId: string): ChapterPlan | null {
    const row = this.database
      .prepare(
        `
          SELECT *
          FROM chapter_plans
          WHERE chapter_id = ?
          ORDER BY created_at DESC
          LIMIT 1
        `,
      )
      .get(chapterId) as ChapterPlanRow | undefined

    return row ? mapChapterPlan(row) : null
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
    requiredCharacterIds: JSON.parse(row.required_character_ids_json) as string[],
    requiredLocationIds: JSON.parse(row.required_location_ids_json) as string[],
    requiredFactionIds: JSON.parse(row.required_faction_ids_json) as string[],
    requiredItemIds: JSON.parse(row.required_item_ids_json) as string[],
    eventOutline: JSON.parse(row.event_outline_json) as string[],
    hookPlan: JSON.parse(row.hook_plan_json) as ChapterPlan['hookPlan'],
    statePredictions: JSON.parse(row.state_predictions_json) as string[],
    memoryCandidates: JSON.parse(row.memory_candidates_json) as string[],
    createdAt: row.created_at,
    approvedByUser: row.approved_by_user === 1,
  }
}
