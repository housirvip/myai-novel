import fs from "node:fs";
import path from "node:path";

import pino, { type Logger, type LoggerOptions, multistream } from "pino";
import pretty from "pino-pretty";

import { env } from "../../config/env.js";
import type { RunContext } from "./context.js";
import { createRunContext } from "./context.js";
import { serializeError } from "./serializers.js";

export type AppLogger = Logger;

export function createLogger(context?: Partial<RunContext>): AppLogger {
  ensureLogDir();

  const appLogFile = path.join(env.LOG_DIR, `app-${getDateStamp()}.log`);
  const streams = [
    {
      level: env.LOG_LEVEL,
      stream:
        env.LOG_FORMAT === "pretty"
          ? pretty({
              colorize: true,
              translateTime: "SYS:standard",
              ignore: "pid,hostname",
            })
          : process.stdout,
    },
    {
      level: env.LOG_LEVEL,
      stream: pino.destination({
        dest: appLogFile,
        mkdir: true,
        sync: false,
      }),
    },
  ];

  const options: LoggerOptions = {
    level: env.LOG_LEVEL,
    base: undefined,
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level(label) {
        return { level: label };
      },
    },
  };

  const logger = pino(options, multistream(streams));

  return logger.child({
    traceId: context?.traceId,
    runId: context?.runId,
    command: context?.command,
  });
}

export async function withTimingLog<T>(
  logger: AppLogger,
  metadata: Record<string, unknown>,
  action: () => Promise<T>,
): Promise<T> {
  const startedAt = Date.now();
  logger.info({ ...metadata, event: "operation.start" }, "Operation started");

  try {
    const result = await action();
    logger.info(
      {
        ...metadata,
        event: "operation.finish",
        success: true,
        durationMs: Date.now() - startedAt,
      },
      "Operation finished",
    );
    return result;
  } catch (error) {
    logger.error(
      {
        ...metadata,
        event: "operation.error",
        success: false,
        durationMs: Date.now() - startedAt,
        ...serializeError(error),
      },
      "Operation failed",
    );
    throw error;
  }
}

export { createRunContext };

function ensureLogDir(): void {
  fs.mkdirSync(env.LOG_DIR, { recursive: true });
}

function getDateStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

