import type { VolumePlan } from '../../shared/types/domain.js'
import type { NovelDatabase } from '../db/database.js'
import { dbAll, dbAllAsync, dbGet, dbGetAsync, dbRun, dbRunAsync } from '../db/db-client.js'

type VolumePlanRow = {
  id: string
  book_id: string
  volume_id: string
  title: string
  focus_summary: string
  rolling_window_json: string
  thread_ids_json: string
  chapter_missions_json: string
  ending_setup_requirements_json: string
  created_at: string
  updated_at: string
}

/**
 * `VolumePlanRepository` 保存卷级导演真源。
 *
 * 它与 `ChapterPlanRepository` 的差别在于：
 * - 这里更关注滚动窗口、thread 和 chapter mission 的连续规划
 * - chapter planning 会把这里的最新版本当作导演信号，而不是逐章重复定义卷级职责
 */
export class VolumePlanRepository {
  constructor(private readonly database: NovelDatabase) {}

  create(plan: VolumePlan): void {
    dbRun(
      this.database,
      `
        INSERT INTO volume_plans (
          id,
          book_id,
          volume_id,
          title,
          focus_summary,
          rolling_window_json,
          thread_ids_json,
          chapter_missions_json,
          ending_setup_requirements_json,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      plan.id,
      plan.bookId,
      plan.volumeId,
      plan.title,
      plan.focusSummary,
      JSON.stringify(plan.rollingWindow),
      JSON.stringify(plan.threadIds),
      JSON.stringify(plan.chapterMissions),
      JSON.stringify(plan.endingSetupRequirements),
      plan.createdAt,
      plan.updatedAt,
    )
  }

  async createAsync(plan: VolumePlan): Promise<void> {
    await dbRunAsync(
      this.database,
      `
        INSERT INTO volume_plans (
          id,
          book_id,
          volume_id,
          title,
          focus_summary,
          rolling_window_json,
          thread_ids_json,
          chapter_missions_json,
          ending_setup_requirements_json,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      plan.id,
      plan.bookId,
      plan.volumeId,
      plan.title,
      plan.focusSummary,
      JSON.stringify(plan.rollingWindow),
      JSON.stringify(plan.threadIds),
      JSON.stringify(plan.chapterMissions),
      JSON.stringify(plan.endingSetupRequirements),
      plan.createdAt,
      plan.updatedAt,
    )
  }

  getLatestByVolumeId(volumeId: string): VolumePlan | null {
    // 这里优先按 updated_at 取最新，因为卷计划允许在同一条规划线上被持续修订。
    const row = dbGet<VolumePlanRow>(
      this.database,
      `
        SELECT *
        FROM volume_plans
        WHERE volume_id = ?
        ORDER BY updated_at DESC, created_at DESC
        LIMIT 1
      `,
      volumeId,
    )

    return row ? mapVolumePlan(row) : null
  }

  async getLatestByVolumeIdAsync(volumeId: string): Promise<VolumePlan | null> {
    const row = await dbGetAsync<VolumePlanRow>(
      this.database,
      `
        SELECT *
        FROM volume_plans
        WHERE volume_id = ?
        ORDER BY updated_at DESC, created_at DESC
        LIMIT 1
      `,
      volumeId,
    )

    return row ? mapVolumePlan(row) : null
  }

  listByVolumeId(volumeId: string): VolumePlan[] {
    const rows = dbAll<VolumePlanRow>(
      this.database,
      `
        SELECT *
        FROM volume_plans
        WHERE volume_id = ?
        ORDER BY updated_at DESC, created_at DESC
      `,
      volumeId,
    )

    return rows.map(mapVolumePlan)
  }

  async listByVolumeIdAsync(volumeId: string): Promise<VolumePlan[]> {
    const rows = await dbAllAsync<VolumePlanRow>(
      this.database,
      `
        SELECT *
        FROM volume_plans
        WHERE volume_id = ?
        ORDER BY updated_at DESC, created_at DESC
      `,
      volumeId,
    )

    return rows.map(mapVolumePlan)
  }
}

function mapVolumePlan(row: VolumePlanRow): VolumePlan {
  // 卷计划里的 mission / rolling window 都以 JSON 形式持久化，读取时统一在这里还原。
  return {
    id: row.id,
    bookId: row.book_id,
    volumeId: row.volume_id,
    title: row.title,
    focusSummary: row.focus_summary,
    rollingWindow: JSON.parse(row.rolling_window_json) as VolumePlan['rollingWindow'],
    threadIds: JSON.parse(row.thread_ids_json) as string[],
    chapterMissions: JSON.parse(row.chapter_missions_json) as VolumePlan['chapterMissions'],
    endingSetupRequirements: JSON.parse(row.ending_setup_requirements_json) as VolumePlan['endingSetupRequirements'],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
