import type { Kysely } from "kysely";

import { createDatabaseManager } from "../../core/db/client.js";
import type { DatabaseSchema } from "../../core/db/schema/database.js";
import type { AppLogger } from "../../core/logger/index.js";
import { withTimingLog } from "../../core/logger/index.js";

export async function executeDbAction<T>(
  logger: AppLogger,
  metadata: Record<string, unknown>,
  action: (db: Kysely<DatabaseSchema>) => Promise<T>,
): Promise<T> {
  const manager = createDatabaseManager(logger);

  try {
    return await withTimingLog(logger, metadata, async () => action(manager.getClient()));
  } finally {
    await manager.destroy();
  }
}
