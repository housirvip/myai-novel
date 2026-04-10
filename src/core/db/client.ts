import type { Kysely } from "kysely";

import { env } from "../../config/env.js";
import type { AppLogger } from "../logger/index.js";
import { createSqliteDb } from "./dialects/sqlite.js";
import type { DatabaseSchema } from "./schema/database.js";

export interface DatabaseManager {
  getClient(): Kysely<DatabaseSchema>;
  migrate(): Promise<void>;
  destroy(): Promise<void>;
}

export function createDatabaseManager(logger: AppLogger): DatabaseManager {
  let client: Kysely<DatabaseSchema> | null = null;

  return {
    getClient(): Kysely<DatabaseSchema> {
      if (client) {
        return client;
      }

      if (env.DB_CLIENT !== "sqlite") {
        throw new Error(`Unsupported DB client for now: ${env.DB_CLIENT}`);
      }

      client = createSqliteDb();
      logger.debug(
        {
          event: "db.client.created",
          dbClient: env.DB_CLIENT,
          sqlitePath: env.DB_SQLITE_PATH,
        },
        "Database client created",
      );
      return client;
    },

    async migrate(): Promise<void> {
      logger.info({ event: "db.migrate.skipped" }, "Migrations are not implemented yet");
    },

    async destroy(): Promise<void> {
      if (!client) {
        return;
      }

      await client.destroy();
      client = null;
      logger.debug({ event: "db.client.destroyed" }, "Database client destroyed");
    },
  };
}
