import { z } from "zod";

import {
  RelationRepository,
  type RelationRow,
} from "../../core/db/repositories/relation-repository.js";
import type { AppLogger } from "../../core/logger/index.js";
import { omitUndefined } from "../../shared/utils/object.js";
import { nowIso } from "../../shared/utils/time.js";
import { executeDbAction } from "../shared/service-helpers.js";

const createRelationSchema = z.object({
  bookId: z.number().int().positive(),
  sourceType: z.string().min(1),
  sourceId: z.number().int().positive(),
  targetType: z.string().min(1),
  targetId: z.number().int().positive(),
  relationType: z.string().min(1),
  intensity: z.number().int().min(0).max(100).nullable().optional(),
  status: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  appendNotes: z.string().nullable().optional(),
  keywords: z.string().nullable().optional(),
});

const updateRelationSchema = createRelationSchema.partial().extend({
  id: z.number().int().positive(),
});

export class RelationService {
  constructor(private readonly logger: AppLogger) {}

  async create(input: z.input<typeof createRelationSchema>): Promise<RelationRow> {
    const payload = createRelationSchema.parse(input);
    const timestamp = nowIso();

    return executeDbAction(
      this.logger,
      { event: "db.create", table: "relations", entityType: "relation", bookId: payload.bookId },
      async (db) =>
        new RelationRepository(db).create({
          book_id: payload.bookId,
          source_type: payload.sourceType,
          source_id: payload.sourceId,
          target_type: payload.targetType,
          target_id: payload.targetId,
          relation_type: payload.relationType,
          intensity: payload.intensity ?? null,
          status: payload.status ?? "active",
          description: payload.description ?? null,
          append_notes: payload.appendNotes ?? null,
          keywords: payload.keywords ?? null,
          created_at: timestamp,
          updated_at: timestamp,
        }),
    );
  }

  async list(bookId: number, limit = 50, status?: string): Promise<RelationRow[]> {
    return executeDbAction(
      this.logger,
      { event: "db.list", table: "relations", entityType: "relation", bookId, limit, status },
      async (db) => new RelationRepository(db).listByBookId(bookId, limit, status),
    );
  }

  async get(id: number): Promise<RelationRow> {
    return executeDbAction(
      this.logger,
      { event: "db.get", table: "relations", entityType: "relation", entityId: id },
      async (db) => {
        const record = await new RelationRepository(db).getById(id);
        if (!record) {
          throw new Error(`Relation not found: ${id}`);
        }
        return record;
      },
    );
  }

  async update(input: z.input<typeof updateRelationSchema>): Promise<RelationRow> {
    const payload = updateRelationSchema.parse(input);

    return executeDbAction(
      this.logger,
      { event: "db.update", table: "relations", entityType: "relation", entityId: payload.id },
      async (db) => {
        const record = await new RelationRepository(db).updateById(
          payload.id,
          omitUndefined({
            book_id: payload.bookId,
            source_type: payload.sourceType,
            source_id: payload.sourceId,
            target_type: payload.targetType,
            target_id: payload.targetId,
            relation_type: payload.relationType,
            intensity: payload.intensity,
            status: payload.status,
            description: payload.description,
            append_notes: payload.appendNotes,
            keywords: payload.keywords,
            updated_at: nowIso(),
          }),
        );

        if (!record) {
          throw new Error(`Relation not found: ${payload.id}`);
        }

        return record;
      },
    );
  }

  async remove(id: number): Promise<void> {
    await executeDbAction(
      this.logger,
      { event: "db.delete", table: "relations", entityType: "relation", entityId: id },
      async (db) => {
        const deleted = await new RelationRepository(db).deleteById(id);
        if (!deleted) {
          throw new Error(`Relation not found: ${id}`);
        }
      },
    );
  }
}
