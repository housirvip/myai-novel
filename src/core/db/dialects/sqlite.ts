import fs from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";
import { Kysely, SqliteDialect } from "kysely";

import { env } from "../../../config/env.js";
import type { DatabaseSchema } from "../schema/database.js";

export function createSqliteDb(): Kysely<DatabaseSchema> {
  fs.mkdirSync(path.dirname(env.DB_SQLITE_PATH), { recursive: true });

  const sqlite = new Database(env.DB_SQLITE_PATH);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  return new Kysely<DatabaseSchema>({
    dialect: new SqliteDialect({
      database: sqlite,
    }),
  });
}

