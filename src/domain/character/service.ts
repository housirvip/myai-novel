import { z } from "zod";

import {
  CharacterRepository,
  type CharacterRow,
} from "../../core/db/repositories/character-repository.js";
import type { AppLogger } from "../../core/logger/index.js";
import { omitUndefined } from "../../shared/utils/object.js";
import { nowIso } from "../../shared/utils/time.js";
import { executeDbAction } from "../shared/service-helpers.js";

const createCharacterSchema = z.object({
  bookId: z.number().int().positive(),
  name: z.string().min(1),
  alias: z.string().nullable().optional(),
  gender: z.string().nullable().optional(),
  age: z.number().int().positive().nullable().optional(),
  personality: z.string().nullable().optional(),
  background: z.string().nullable().optional(),
  currentLocation: z.string().nullable().optional(),
  status: z.string().min(1).default("alive"),
  professions: z.string().nullable().optional(),
  levels: z.string().nullable().optional(),
  currencies: z.string().nullable().optional(),
  abilities: z.string().nullable().optional(),
  goal: z.string().nullable().optional(),
  appendNotes: z.string().nullable().optional(),
  keywords: z.string().nullable().optional(),
});

const updateCharacterSchema = createCharacterSchema.partial().extend({
  id: z.number().int().positive(),
});

export class CharacterService {
  constructor(private readonly logger: AppLogger) {}

  async create(input: z.input<typeof createCharacterSchema>): Promise<CharacterRow> {
    const payload = createCharacterSchema.parse(input);
    const timestamp = nowIso();

    return executeDbAction(
      this.logger,
      {
        event: "db.create",
        table: "characters",
        entityType: "character",
        bookId: payload.bookId,
      },
      async (db) =>
        new CharacterRepository(db).create({
          book_id: payload.bookId,
          name: payload.name,
          alias: payload.alias ?? null,
          gender: payload.gender ?? null,
          age: payload.age ?? null,
          personality: payload.personality ?? null,
          background: payload.background ?? null,
          current_location: payload.currentLocation ?? null,
          status: payload.status,
          professions: payload.professions ?? null,
          levels: payload.levels ?? null,
          currencies: payload.currencies ?? null,
          abilities: payload.abilities ?? null,
          goal: payload.goal ?? null,
          append_notes: payload.appendNotes ?? null,
          keywords: payload.keywords ?? null,
          created_at: timestamp,
          updated_at: timestamp,
        }),
    );
  }

  async list(bookId: number, limit = 50, status?: string): Promise<CharacterRow[]> {
    return executeDbAction(
      this.logger,
      { event: "db.list", table: "characters", entityType: "character", bookId, limit, status },
      async (db) => new CharacterRepository(db).listByBookId(bookId, limit, status),
    );
  }

  async get(id: number): Promise<CharacterRow> {
    return executeDbAction(
      this.logger,
      { event: "db.get", table: "characters", entityType: "character", entityId: id },
      async (db) => {
        const record = await new CharacterRepository(db).getById(id);
        if (!record) {
          throw new Error(`Character not found: ${id}`);
        }
        return record;
      },
    );
  }

  async update(input: z.input<typeof updateCharacterSchema>): Promise<CharacterRow> {
    const payload = updateCharacterSchema.parse(input);

    return executeDbAction(
      this.logger,
      { event: "db.update", table: "characters", entityType: "character", entityId: payload.id },
      async (db) => {
        const record = await new CharacterRepository(db).updateById(
          payload.id,
          omitUndefined({
            book_id: payload.bookId,
            name: payload.name,
            alias: payload.alias,
            gender: payload.gender,
            age: payload.age,
            personality: payload.personality,
            background: payload.background,
            current_location: payload.currentLocation,
            status: payload.status,
            professions: payload.professions,
            levels: payload.levels,
            currencies: payload.currencies,
            abilities: payload.abilities,
            goal: payload.goal,
            append_notes: payload.appendNotes,
            keywords: payload.keywords,
            updated_at: nowIso(),
          }),
        );

        if (!record) {
          throw new Error(`Character not found: ${payload.id}`);
        }

        return record;
      },
    );
  }

  async remove(id: number): Promise<void> {
    await executeDbAction(
      this.logger,
      { event: "db.delete", table: "characters", entityType: "character", entityId: id },
      async (db) => {
        const deleted = await new CharacterRepository(db).deleteById(id);
        if (!deleted) {
          throw new Error(`Character not found: ${id}`);
        }
      },
    );
  }
}
