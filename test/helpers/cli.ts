import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);

const rootDir = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));
const tsxBin = path.join(
  rootDir,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "tsx.cmd" : "tsx",
);

export function createTestEnv(tempDir: string, overrides: Record<string, string> = {}): NodeJS.ProcessEnv {
  return {
    ...process.env,
    NODE_ENV: "test",
    LOG_LEVEL: "fatal",
    LOG_FORMAT: "json",
    LOG_DIR: path.join(tempDir, "logs"),
    DB_CLIENT: "sqlite",
    DB_SQLITE_PATH: path.join(tempDir, "novel.sqlite"),
    LLM_PROVIDER: "mock",
    MOCK_LLM_MODE: "echo",
    ...overrides,
  };
}

export async function runCli(args: string[], env: NodeJS.ProcessEnv): Promise<string> {
  try {
    const result = await execFileAsync(tsxBin, ["src/index.ts", ...args], {
      cwd: rootDir,
      env,
      maxBuffer: 10 * 1024 * 1024,
    });

    return result.stdout.trim();
  } catch (error) {
    if (isExecError(error)) {
      const detail = [error.stdout, error.stderr].filter(Boolean).join("\n").trim();
      throw new Error(detail || error.message);
    }

    throw error;
  }
}

export async function runCliJson<T>(args: string[], env: NodeJS.ProcessEnv): Promise<T> {
  const finalArgs = args.includes("--json") ? args : [...args, "--json"];
  const output = await runCli(finalArgs, env);
  return parseJsonPayload<T>(output);
}

export async function runInlineModule<T = unknown>(
  code: string,
  env: NodeJS.ProcessEnv,
): Promise<T> {
  try {
    const result = await execFileAsync(
      process.execPath,
      ["--import", "tsx", "--input-type=module", "--eval", code],
      {
        cwd: rootDir,
        env,
        maxBuffer: 10 * 1024 * 1024,
      },
    );

    return parseJsonPayload<T>(result.stdout);
  } catch (error) {
    if (isExecError(error)) {
      const detail = [error.stdout, error.stderr].filter(Boolean).join("\n").trim();
      throw new Error(detail || error.message);
    }

    throw error;
  }
}

function isExecError(
  error: unknown,
): error is Error & { stdout?: string; stderr?: string } {
  return error instanceof Error;
}

function parseJsonPayload<T>(output: string): T {
  const trimmed = output.trim();

  try {
    return JSON.parse(trimmed) as T;
  } catch {
    const lines = trimmed
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    const lastLine = lines.at(-1);

    if (!lastLine) {
      throw new Error("Expected JSON output but stdout was empty");
    }

    return JSON.parse(lastLine) as T;
  }
}
