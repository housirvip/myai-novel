import { randomUUID } from "node:crypto";

export interface RunContext {
  traceId: string;
  runId: string;
  command: string;
}

export function createRunContext(input: { command: string }): RunContext {
  return {
    traceId: randomUUID(),
    runId: randomUUID(),
    command: input.command,
  };
}

