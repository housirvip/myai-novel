import { z } from "zod";

import {
  FactionRepository,
  type FactionRow,
} from "../../core/db/repositories/faction-repository.js";
import type { AppLogger } from "../../core/logger/index.js";
import { omitUndefined } from "../../shared/utils/object.js";
import { nowIso } from "../../shared/utils/time.js";
import { executeDbAction } from "../shared/service-helpers.js";

const createFactionSchema = z.object({
  bookId: z.number().int().positive(),
  name: z.string().min(1),
  category: z.string().nullable().optional(),
  coreGoal: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  leaderCharacterId: z.number().int().positive().nullable().optional(),
  headquarter: z.string().nullable().optional(),
  status: z.string().nullable().optional(),
  appendNotes: z.string().nullable().optional(),
  keywords: z.string().nullable().optional(),
});

const updateFactionSchema = createFactionSchema.partial().extend({
  id: z.number().int().positive(),
});

export class FactionService {
  constructor(private readonly logger: AppLogger) {}

  async create(input: z.input<typeof createFactionSchema>): Promise<FactionRow> {
    const payload = createFactionSchema.parse(input);
    const timestamp = nowIso();

    return executeDbAction(
      this.logger,
      { event: "db.create", table: "factions", entityType: "faction", bookId: payload.bookId },
      async (db) =>
        new FactionRepository(db).create({
          book_id: payload.bookId,
          name: payload.name,
          category: payload.category ?? null,
          core_goal: payload.coreGoal ?? null,
          description: payload.description ?? null,
          leader_character_id: payload.leaderCharacterId ?? null,
          headquarter: payload.headquarter ?? null,
          status: payload.status ?? "active",
          append_notes: payload.appendNotes ?? null,
          keywords: payload.keywords ?? null,
          created_at: timestamp,
          updated_at: timestamp,
        }),
    );
  }

  async list(bookId: number, limit = 50, status?: string): Promise<FactionRow[]> {
    return executeDbAction(
      this.logger,
      { event: "db.list", table: "factions", entityType: "faction", bookId, limit, status },
      async (db) => new FactionRepository(db).listByBookId(bookId, limit, status),
    );
  }

  async get(id: number): Promise<FactionRow> {
    return executeDbAction(
      this.logger,
      { event: "db.get", table: "factions", entityType: "faction", entityId: id },
      async (db) => {
        const record = await new FactionRepository(db).getById(id);
        if (!record) {
          throw new Error(`Faction not found: ${id}`);
        }
        return record;
      },
    );
  }

  async update(input: z.input<typeof updateFactionSchema>): Promise<FactionRow> {
    const payload = updateFactionSchema.parse(input);

    return executeDbAction(
      this.logger,
      { event: "db.update", table: "factions", entityType: "faction", entityId: payload.id },
      async (db) => {
        const record = await new FactionRepository(db).updateById(
          payload.id,
          omitUndefined({
            book_id: payload.bookId,
            name: payload.name,
            category: payload.category,
            core_goal: payload.coreGoal,
            description: payload.description,
            leader_character_id: payload.leaderCharacterId,
            headquarter: payload.headquarter,
            status: payload.status,
            append_notes: payload.appendNotes,
            keywords: payload.keywords,
            updated_at: nowIso(),
          }),
        );

        if (!record) {
          throw new Error(`Faction not found: ${payload.id}`);
        }

        return record;
      },
    );
  }

  async remove(id: number): Promise<void> {
    await executeDbAction(
      this.logger,
      { event: "db.delete", table: "factions", entityType: "faction", entityId: id },
      async (db) => {
        const deleted = await new FactionRepository(db).deleteById(id);
        if (!deleted) {
          throw new Error(`Faction not found: ${id}`);
        }
      },
    );
  }
}
