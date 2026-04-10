import { createLogger, createRunContext } from "../core/logger/index.js";

export async function runCliCommand(
  command: string,
  action: (logger: ReturnType<typeof createLogger>) => Promise<void>,
): Promise<void> {
  const context = createRunContext({ command });
  const logger = createLogger(context);

  logger.info({ event: "command.start" }, "Command started");

  try {
    await action(logger);
    logger.info({ event: "command.finish", success: true }, "Command finished");
  } catch (error) {
    logger.error(
      {
        event: "command.error",
        success: false,
        error,
      },
      "Command failed",
    );
    process.exitCode = 1;
  }
}

