import { z } from "zod";

import {
  StoryHookRepository,
  type StoryHookRow,
} from "../../core/db/repositories/story-hook-repository.js";
import type { AppLogger } from "../../core/logger/index.js";
import { omitUndefined } from "../../shared/utils/object.js";
import { nowIso } from "../../shared/utils/time.js";
import { executeDbAction } from "../shared/service-helpers.js";

const createStoryHookSchema = z.object({
  bookId: z.number().int().positive(),
  title: z.string().min(1),
  hookType: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  sourceChapterNo: z.number().int().positive().nullable().optional(),
  targetChapterNo: z.number().int().positive().nullable().optional(),
  status: z.string().min(1).default("open"),
  importance: z.string().nullable().optional(),
  appendNotes: z.string().nullable().optional(),
  keywords: z.string().nullable().optional(),
});

const updateStoryHookSchema = createStoryHookSchema.partial().extend({
  id: z.number().int().positive(),
});

export class StoryHookService {
  constructor(private readonly logger: AppLogger) {}

  async create(input: z.input<typeof createStoryHookSchema>): Promise<StoryHookRow> {
    const payload = createStoryHookSchema.parse(input);
    const timestamp = nowIso();

    return executeDbAction(
      this.logger,
      {
        event: "db.create",
        table: "story_hooks",
        entityType: "story_hook",
        bookId: payload.bookId,
      },
      async (db) =>
        new StoryHookRepository(db).create({
          book_id: payload.bookId,
          title: payload.title,
          hook_type: payload.hookType ?? null,
          description: payload.description ?? null,
          source_chapter_no: payload.sourceChapterNo ?? null,
          target_chapter_no: payload.targetChapterNo ?? null,
          status: payload.status,
          importance: payload.importance ?? null,
          append_notes: payload.appendNotes ?? null,
          keywords: payload.keywords ?? null,
          created_at: timestamp,
          updated_at: timestamp,
        }),
    );
  }

  async list(bookId: number, limit = 50, status?: string): Promise<StoryHookRow[]> {
    return executeDbAction(
      this.logger,
      {
        event: "db.list",
        table: "story_hooks",
        entityType: "story_hook",
        bookId,
        limit,
        status,
      },
      async (db) => new StoryHookRepository(db).listByBookId(bookId, limit, status),
    );
  }

  async get(id: number): Promise<StoryHookRow> {
    return executeDbAction(
      this.logger,
      { event: "db.get", table: "story_hooks", entityType: "story_hook", entityId: id },
      async (db) => {
        const record = await new StoryHookRepository(db).getById(id);
        if (!record) {
          throw new Error(`Story hook not found: ${id}`);
        }
        return record;
      },
    );
  }

  async update(input: z.input<typeof updateStoryHookSchema>): Promise<StoryHookRow> {
    const payload = updateStoryHookSchema.parse(input);

    return executeDbAction(
      this.logger,
      {
        event: "db.update",
        table: "story_hooks",
        entityType: "story_hook",
        entityId: payload.id,
      },
      async (db) => {
        const record = await new StoryHookRepository(db).updateById(
          payload.id,
          omitUndefined({
            book_id: payload.bookId,
            title: payload.title,
            hook_type: payload.hookType,
            description: payload.description,
            source_chapter_no: payload.sourceChapterNo,
            target_chapter_no: payload.targetChapterNo,
            status: payload.status,
            importance: payload.importance,
            append_notes: payload.appendNotes,
            keywords: payload.keywords,
            updated_at: nowIso(),
          }),
        );

        if (!record) {
          throw new Error(`Story hook not found: ${payload.id}`);
        }

        return record;
      },
    );
  }

  async remove(id: number): Promise<void> {
    await executeDbAction(
      this.logger,
      { event: "db.delete", table: "story_hooks", entityType: "story_hook", entityId: id },
      async (db) => {
        const deleted = await new StoryHookRepository(db).deleteById(id);
        if (!deleted) {
          throw new Error(`Story hook not found: ${id}`);
        }
      },
    );
  }
}
