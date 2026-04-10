import Database from "better-sqlite3";
import { Kysely, SqliteDialect } from "kysely";

import type { DatabaseSchema } from "../../src/core/db/schema/database.js";

export function createInMemoryDb(): Kysely<DatabaseSchema> {
  const sqlite = new Database(":memory:");
  sqlite.pragma("foreign_keys = ON");

  return new Kysely<DatabaseSchema>({
    dialect: new SqliteDialect({ database: sqlite }),
  });
}

export function createNoopLogger(): {
  info: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  debug: (...args: unknown[]) => void;
} {
  return {
    info() {},
    error() {},
    debug() {},
  };
}
