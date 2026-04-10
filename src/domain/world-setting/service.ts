import { z } from "zod";

import {
  WorldSettingRepository,
  type WorldSettingRow,
} from "../../core/db/repositories/world-setting-repository.js";
import type { AppLogger } from "../../core/logger/index.js";
import { omitUndefined } from "../../shared/utils/object.js";
import { nowIso } from "../../shared/utils/time.js";
import { executeDbAction } from "../shared/service-helpers.js";

const createWorldSettingSchema = z.object({
  bookId: z.number().int().positive(),
  title: z.string().min(1),
  category: z.string().min(1),
  content: z.string().min(1),
  status: z.string().min(1).default("active"),
  appendNotes: z.string().nullable().optional(),
  keywords: z.string().nullable().optional(),
});

const updateWorldSettingSchema = createWorldSettingSchema.partial().extend({
  id: z.number().int().positive(),
});

export class WorldSettingService {
  constructor(private readonly logger: AppLogger) {}

  async create(input: z.input<typeof createWorldSettingSchema>): Promise<WorldSettingRow> {
    const payload = createWorldSettingSchema.parse(input);
    const timestamp = nowIso();

    return executeDbAction(
      this.logger,
      {
        event: "db.create",
        table: "world_settings",
        entityType: "world_setting",
        bookId: payload.bookId,
      },
      async (db) =>
        new WorldSettingRepository(db).create({
          book_id: payload.bookId,
          title: payload.title,
          category: payload.category,
          content: payload.content,
          status: payload.status,
          append_notes: payload.appendNotes ?? null,
          keywords: payload.keywords ?? null,
          created_at: timestamp,
          updated_at: timestamp,
        }),
    );
  }

  async list(bookId: number, limit = 50, status?: string): Promise<WorldSettingRow[]> {
    return executeDbAction(
      this.logger,
      {
        event: "db.list",
        table: "world_settings",
        entityType: "world_setting",
        bookId,
        limit,
        status,
      },
      async (db) => new WorldSettingRepository(db).listByBookId(bookId, limit, status),
    );
  }

  async get(id: number): Promise<WorldSettingRow> {
    return executeDbAction(
      this.logger,
      {
        event: "db.get",
        table: "world_settings",
        entityType: "world_setting",
        entityId: id,
      },
      async (db) => {
        const record = await new WorldSettingRepository(db).getById(id);
        if (!record) {
          throw new Error(`World setting not found: ${id}`);
        }
        return record;
      },
    );
  }

  async update(input: z.input<typeof updateWorldSettingSchema>): Promise<WorldSettingRow> {
    const payload = updateWorldSettingSchema.parse(input);

    return executeDbAction(
      this.logger,
      {
        event: "db.update",
        table: "world_settings",
        entityType: "world_setting",
        entityId: payload.id,
      },
      async (db) => {
        const record = await new WorldSettingRepository(db).updateById(
          payload.id,
          omitUndefined({
            book_id: payload.bookId,
            title: payload.title,
            category: payload.category,
            content: payload.content,
            status: payload.status,
            append_notes: payload.appendNotes,
            keywords: payload.keywords,
            updated_at: nowIso(),
          }),
        );

        if (!record) {
          throw new Error(`World setting not found: ${payload.id}`);
        }

        return record;
      },
    );
  }

  async remove(id: number): Promise<void> {
    await executeDbAction(
      this.logger,
      {
        event: "db.delete",
        table: "world_settings",
        entityType: "world_setting",
        entityId: id,
      },
      async (db) => {
        const deleted = await new WorldSettingRepository(db).deleteById(id);
        if (!deleted) {
          throw new Error(`World setting not found: ${id}`);
        }
      },
    );
  }
}
