import { Command } from "commander";
import { sql } from "kysely";

import { createDatabaseManager } from "../../core/db/client.js";
import { createLogger, createRunContext } from "../../core/logger/index.js";

export function registerDbCommands(program: Command): void {
  const db = program.command("db").description("Database utilities");

  db.command("init")
    .description("Initialize the database schema")
    .action(async () => {
      await runDbTask("db.init", async (manager) => {
        await manager.migrate();
      });
    });

  db.command("migrate")
    .description("Run database migrations")
    .action(async () => {
      await runDbTask("db.migrate", async (manager) => {
        await manager.migrate();
      });
    });

  db.command("check")
    .description("Check database connectivity")
    .action(async () => {
      await runDbTask("db.check", async (manager) => {
        const database = manager.getClient();
        await sql<{ ok: number }>`select 1 as ok`.execute(database);
      });
    });
}

async function runDbTask(
  command: string,
  task: (manager: ReturnType<typeof createDatabaseManager>) => Promise<void>,
): Promise<void> {
  const context = createRunContext({ command });
  const logger = createLogger(context);
  const manager = createDatabaseManager(logger);

  logger.info({ event: "command.start" }, "Database command started");

  try {
    await task(manager);
    logger.info({ event: "command.finish", success: true }, "Database command finished");
  } catch (error) {
    logger.error(
      {
        event: "command.error",
        success: false,
        error,
      },
      "Database command failed",
    );
    process.exitCode = 1;
  } finally {
    await manager.destroy();
  }
}
