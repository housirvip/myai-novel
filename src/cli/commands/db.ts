import { Command } from "commander";
import { sql } from "kysely";

import { createDatabaseManager } from "../../core/db/client.js";
import { createLogger, createRunContext } from "../../core/logger/index.js";

export function registerDbCommands(program: Command): void {
  const db = program.command("db").description("Database utilities");

  db.command("check")
    .description("Check database connectivity")
    .action(async () => {
      const context = createRunContext({ command: "db.check" });
      const logger = createLogger(context);
      const manager = createDatabaseManager(logger);

      try {
        const database = manager.getClient();
        await sql<{ ok: number }>`select 1 as ok`.execute(database);
        logger.info({ event: "command.finish", success: true }, "Database connection OK");
      } catch (error) {
        logger.error(
          {
            event: "command.error",
            success: false,
            error,
          },
          "Database connectivity check failed",
        );
        process.exitCode = 1;
      } finally {
        await manager.destroy();
      }
    });
}
