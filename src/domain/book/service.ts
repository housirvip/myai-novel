import { z } from "zod";

import type { AppLogger } from "../../core/logger/index.js";
import { withTimingLog } from "../../core/logger/index.js";
import { BookRepository, type BookRow } from "../../core/db/repositories/book-repository.js";
import { createDatabaseManager } from "../../core/db/client.js";
import { nowIso } from "../../shared/utils/time.js";

const createBookSchema = z.object({
  title: z.string().min(1),
  summary: z.string().optional(),
  targetChapterCount: z.number().int().positive().optional(),
  status: z.string().default("planning"),
});

const updateBookSchema = z.object({
  id: z.number().int().positive(),
  title: z.string().min(1).optional(),
  summary: z.string().optional(),
  targetChapterCount: z.number().int().positive().optional(),
  status: z.string().optional(),
});

export class BookService {
  constructor(private readonly logger: AppLogger) {}

  async create(input: z.input<typeof createBookSchema>): Promise<BookRow> {
    const payload = createBookSchema.parse(input);
    const manager = createDatabaseManager(this.logger);

    try {
      return await withTimingLog(
        this.logger,
        {
          event: "db.create",
          table: "books",
          entityType: "book",
        },
        async () => {
          const repository = new BookRepository(manager.getClient());
          return repository.create({
            title: payload.title,
            summary: payload.summary ?? null,
            target_chapter_count: payload.targetChapterCount ?? null,
            current_chapter_count: 0,
            status: payload.status,
            metadata: null,
            created_at: nowIso(),
            updated_at: nowIso(),
          });
        },
      );
    } finally {
      await manager.destroy();
    }
  }

  async list(limit = 50): Promise<BookRow[]> {
    const manager = createDatabaseManager(this.logger);

    try {
      return await withTimingLog(
        this.logger,
        {
          event: "db.list",
          table: "books",
          entityType: "book",
          limit,
        },
        async () => {
          const repository = new BookRepository(manager.getClient());
          return repository.list(limit);
        },
      );
    } finally {
      await manager.destroy();
    }
  }

  async get(id: number): Promise<BookRow> {
    const manager = createDatabaseManager(this.logger);

    try {
      return await withTimingLog(
        this.logger,
        {
          event: "db.get",
          table: "books",
          entityType: "book",
          entityId: id,
        },
        async () => {
          const repository = new BookRepository(manager.getClient());
          const record = await repository.getById(id);
          if (!record) {
            throw new Error(`Book not found: ${id}`);
          }
          return record;
        },
      );
    } finally {
      await manager.destroy();
    }
  }

  async update(input: z.input<typeof updateBookSchema>): Promise<BookRow> {
    const payload = updateBookSchema.parse(input);
    const manager = createDatabaseManager(this.logger);

    try {
      return await withTimingLog(
        this.logger,
        {
          event: "db.update",
          table: "books",
          entityType: "book",
          entityId: payload.id,
        },
        async () => {
          const repository = new BookRepository(manager.getClient());
          const record = await repository.updateById(payload.id, {
            title: payload.title,
            summary: payload.summary,
            target_chapter_count: payload.targetChapterCount,
            status: payload.status,
            updated_at: nowIso(),
          });

          if (!record) {
            throw new Error(`Book not found: ${payload.id}`);
          }

          return record;
        },
      );
    } finally {
      await manager.destroy();
    }
  }

  async remove(id: number): Promise<void> {
    const manager = createDatabaseManager(this.logger);

    try {
      await withTimingLog(
        this.logger,
        {
          event: "db.delete",
          table: "books",
          entityType: "book",
          entityId: id,
        },
        async () => {
          const repository = new BookRepository(manager.getClient());
          const deleted = await repository.deleteById(id);
          if (!deleted) {
            throw new Error(`Book not found: ${id}`);
          }
        },
      );
    } finally {
      await manager.destroy();
    }
  }
}

