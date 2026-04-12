import { Kysely, MysqlDialect } from "kysely";
import mysql from "mysql2/promise";

import { env } from "../../../config/env.js";
import type { DatabaseSchema } from "../schema/database.js";

export function createMysqlDb(): Kysely<DatabaseSchema> {
  const pool = mysql.createPool({
    host: env.DB_HOST,
    port: env.DB_PORT,
    database: env.DB_NAME,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    waitForConnections: true,
    connectionLimit: env.DB_POOL_MAX,
    maxIdle: env.DB_POOL_MAX,
    idleTimeout: 60_000,
    queueLimit: 0,
  });

  return new Kysely<DatabaseSchema>({
    dialect: new MysqlDialect({
      pool,
    }),
  });
}
