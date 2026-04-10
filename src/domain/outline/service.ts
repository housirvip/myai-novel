import { z } from "zod";

import {
  OutlineRepository,
  type OutlineRow,
} from "../../core/db/repositories/outline-repository.js";
import type { AppLogger } from "../../core/logger/index.js";
import { executeDbAction } from "../shared/service-helpers.js";
import { nowIso } from "../../shared/utils/time.js";
import { omitUndefined } from "../../shared/utils/object.js";

const createOutlineSchema = z.object({
  bookId: z.number().int().positive(),
  volumeNo: z.number().int().positive().nullable().optional(),
  volumeTitle: z.string().min(1).nullable().optional(),
  chapterStartNo: z.number().int().positive().nullable().optional(),
  chapterEndNo: z.number().int().positive().nullable().optional(),
  outlineLevel: z.string().min(1).default("chapter_arc"),
  title: z.string().min(1),
  storyCore: z.string().nullable().optional(),
  mainPlot: z.string().nullable().optional(),
  subPlot: z.string().nullable().optional(),
  foreshadowing: z.string().nullable().optional(),
  expectedPayoff: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

const updateOutlineSchema = createOutlineSchema.partial().extend({
  id: z.number().int().positive(),
});

export class OutlineService {
  constructor(private readonly logger: AppLogger) {}

  async create(input: z.input<typeof createOutlineSchema>): Promise<OutlineRow> {
    const payload = createOutlineSchema.parse(input);
    const timestamp = nowIso();

    return executeDbAction(
      this.logger,
      { event: "db.create", table: "outlines", entityType: "outline", bookId: payload.bookId },
      async (db) => {
        const repository = new OutlineRepository(db);
        return repository.create({
          book_id: payload.bookId,
          volume_no: payload.volumeNo ?? null,
          volume_title: payload.volumeTitle ?? null,
          chapter_start_no: payload.chapterStartNo ?? null,
          chapter_end_no: payload.chapterEndNo ?? null,
          outline_level: payload.outlineLevel,
          title: payload.title,
          story_core: payload.storyCore ?? null,
          main_plot: payload.mainPlot ?? null,
          sub_plot: payload.subPlot ?? null,
          foreshadowing: payload.foreshadowing ?? null,
          expected_payoff: payload.expectedPayoff ?? null,
          notes: payload.notes ?? null,
          created_at: timestamp,
          updated_at: timestamp,
        });
      },
    );
  }

  async list(bookId: number, limit = 50): Promise<OutlineRow[]> {
    return executeDbAction(
      this.logger,
      { event: "db.list", table: "outlines", entityType: "outline", bookId, limit },
      async (db) => new OutlineRepository(db).listByBookId(bookId, limit),
    );
  }

  async get(id: number): Promise<OutlineRow> {
    return executeDbAction(
      this.logger,
      { event: "db.get", table: "outlines", entityType: "outline", entityId: id },
      async (db) => {
        const record = await new OutlineRepository(db).getById(id);
        if (!record) {
          throw new Error(`Outline not found: ${id}`);
        }
        return record;
      },
    );
  }

  async update(input: z.input<typeof updateOutlineSchema>): Promise<OutlineRow> {
    const payload = updateOutlineSchema.parse(input);

    return executeDbAction(
      this.logger,
      { event: "db.update", table: "outlines", entityType: "outline", entityId: payload.id },
      async (db) => {
        const record = await new OutlineRepository(db).updateById(
          payload.id,
          omitUndefined({
            volume_no: payload.volumeNo,
            volume_title: payload.volumeTitle,
            chapter_start_no: payload.chapterStartNo,
            chapter_end_no: payload.chapterEndNo,
            outline_level: payload.outlineLevel,
            title: payload.title,
            story_core: payload.storyCore,
            main_plot: payload.mainPlot,
            sub_plot: payload.subPlot,
            foreshadowing: payload.foreshadowing,
            expected_payoff: payload.expectedPayoff,
            notes: payload.notes,
            updated_at: nowIso(),
          }),
        );

        if (!record) {
          throw new Error(`Outline not found: ${payload.id}`);
        }

        return record;
      },
    );
  }

  async remove(id: number): Promise<void> {
    await executeDbAction(
      this.logger,
      { event: "db.delete", table: "outlines", entityType: "outline", entityId: id },
      async (db) => {
        const deleted = await new OutlineRepository(db).deleteById(id);
        if (!deleted) {
          throw new Error(`Outline not found: ${id}`);
        }
      },
    );
  }
}
