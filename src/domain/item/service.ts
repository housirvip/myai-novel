import { z } from "zod";

import {
  ItemRepository,
  type ItemRow,
} from "../../core/db/repositories/item-repository.js";
import type { AppLogger } from "../../core/logger/index.js";
import { omitUndefined } from "../../shared/utils/object.js";
import { nowIso } from "../../shared/utils/time.js";
import { executeDbAction } from "../shared/service-helpers.js";

const createItemSchema = z.object({
  bookId: z.number().int().positive(),
  name: z.string().min(1),
  category: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  ownerType: z.string().min(1).default("none"),
  ownerId: z.number().int().positive().nullable().optional(),
  rarity: z.string().nullable().optional(),
  status: z.string().nullable().optional(),
  appendNotes: z.string().nullable().optional(),
  keywords: z.string().nullable().optional(),
});

const updateItemSchema = createItemSchema.partial().extend({
  id: z.number().int().positive(),
});

export class ItemService {
  constructor(private readonly logger: AppLogger) {}

  async create(input: z.input<typeof createItemSchema>): Promise<ItemRow> {
    const payload = createItemSchema.parse(input);
    const timestamp = nowIso();

    return executeDbAction(
      this.logger,
      { event: "db.create", table: "items", entityType: "item", bookId: payload.bookId },
      async (db) =>
        new ItemRepository(db).create({
          book_id: payload.bookId,
          name: payload.name,
          category: payload.category ?? null,
          description: payload.description ?? null,
          owner_type: payload.ownerType,
          owner_id: payload.ownerId ?? null,
          rarity: payload.rarity ?? null,
          status: payload.status ?? "active",
          append_notes: payload.appendNotes ?? null,
          keywords: payload.keywords ?? null,
          created_at: timestamp,
          updated_at: timestamp,
        }),
    );
  }

  async list(bookId: number, limit = 50, status?: string): Promise<ItemRow[]> {
    return executeDbAction(
      this.logger,
      { event: "db.list", table: "items", entityType: "item", bookId, limit, status },
      async (db) => new ItemRepository(db).listByBookId(bookId, limit, status),
    );
  }

  async get(id: number): Promise<ItemRow> {
    return executeDbAction(
      this.logger,
      { event: "db.get", table: "items", entityType: "item", entityId: id },
      async (db) => {
        const record = await new ItemRepository(db).getById(id);
        if (!record) {
          throw new Error(`Item not found: ${id}`);
        }
        return record;
      },
    );
  }

  async update(input: z.input<typeof updateItemSchema>): Promise<ItemRow> {
    const payload = updateItemSchema.parse(input);

    return executeDbAction(
      this.logger,
      { event: "db.update", table: "items", entityType: "item", entityId: payload.id },
      async (db) => {
        const record = await new ItemRepository(db).updateById(
          payload.id,
          omitUndefined({
            book_id: payload.bookId,
            name: payload.name,
            category: payload.category,
            description: payload.description,
            owner_type: payload.ownerType,
            owner_id: payload.ownerId,
            rarity: payload.rarity,
            status: payload.status,
            append_notes: payload.appendNotes,
            keywords: payload.keywords,
            updated_at: nowIso(),
          }),
        );

        if (!record) {
          throw new Error(`Item not found: ${payload.id}`);
        }

        return record;
      },
    );
  }

  async remove(id: number): Promise<void> {
    await executeDbAction(
      this.logger,
      { event: "db.delete", table: "items", entityType: "item", entityId: id },
      async (db) => {
        const deleted = await new ItemRepository(db).deleteById(id);
        if (!deleted) {
          throw new Error(`Item not found: ${id}`);
        }
      },
    );
  }
}
