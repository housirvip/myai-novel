import { createLogger, createRunContext } from "../core/logger/index.js";

export async function runCliCommand(
  command: string,
  action: (logger: ReturnType<typeof createLogger>) => Promise<void>,
): Promise<void> {
  // 所有 CLI 命令都走同一个 runtime 包装，
  // 这样日志上下文、开始/结束事件和失败退出码策略可以保持统一。
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
    // 这里不直接调用 process.exit()，
    // 是为了让 commander / 测试环境还能完成剩余清理，并通过 exitCode 反映失败结果。
    process.exitCode = 1;
  }
}
