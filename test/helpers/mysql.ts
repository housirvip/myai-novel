import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import mysql from "mysql2/promise";

import { createTestEnv } from "./cli.js";

interface MysqlTestConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

export function hasMysqlTestConfig(): boolean {
  return Boolean(process.env.MYSQL_TEST_HOST && process.env.MYSQL_TEST_USER && process.env.MYSQL_TEST_DATABASE);
}

export async function createMysqlTestContext(prefix: string): Promise<{
  tempDir: string;
  env: NodeJS.ProcessEnv;
  cleanup: () => Promise<void>;
}> {
  const config = await loadMysqlTestConfig();
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), `${prefix}-`));
  const database = `${config.database}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  await withAdminConnection(config, async (connection) => {
    await connection.query(`CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  });

  const env = createTestEnv(tempDir, {
    DB_CLIENT: "mysql",
    DB_HOST: config.host,
    DB_PORT: String(config.port),
    DB_NAME: database,
    DB_USER: config.user,
    DB_PASSWORD: config.password,
    DB_POOL_MAX: "10",
  });

  return {
    tempDir,
    env,
    cleanup: async () => {
      await withAdminConnection(config, async (connection) => {
        await connection.query(`DROP DATABASE IF EXISTS \`${database}\``);
      });

      await fs.rm(tempDir, { recursive: true, force: true });
    },
  };
}

async function loadMysqlTestConfig(): Promise<MysqlTestConfig> {
  const host = process.env.MYSQL_TEST_HOST?.trim();
  const port = Number(process.env.MYSQL_TEST_PORT ?? "3306");
  const user = process.env.MYSQL_TEST_USER?.trim();
  const password = process.env.MYSQL_TEST_PASSWORD ?? "";
  const database = process.env.MYSQL_TEST_DATABASE?.trim();

  assert.ok(host, "Expected MYSQL_TEST_HOST for MySQL integration tests");
  assert.ok(user, "Expected MYSQL_TEST_USER for MySQL integration tests");
  assert.ok(database, "Expected MYSQL_TEST_DATABASE for MySQL integration tests");
  assert.ok(Number.isFinite(port), "Expected MYSQL_TEST_PORT to be a valid number");

  return {
    host,
    port,
    user,
    password,
    database,
  };
}

async function withAdminConnection<T>(
  config: MysqlTestConfig,
  task: (connection: mysql.Connection) => Promise<T>,
): Promise<T> {
  const connection = await mysql.createConnection({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    multipleStatements: false,
  });

  try {
    return await task(connection);
  } finally {
    await connection.end();
  }
}
