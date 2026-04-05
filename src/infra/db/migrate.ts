import type { NovelDatabase } from './database.js'
import { migrations } from './schema.js'
import { isSqliteDatabase } from './sqlite-support.js'

export async function runMigrations(database: NovelDatabase): Promise<void> {
  if (!isSqliteDatabase(database)) {
    await database.dbAsync.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id VARCHAR(191) PRIMARY KEY,
        applied_at VARCHAR(64) NOT NULL
      );
    `)
  } else {
    database.db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id TEXT PRIMARY KEY,
        applied_at TEXT NOT NULL
      );
    `)
  }

  for (const migration of migrations) {
    const alreadyApplied = await database.dbAsync.get<{ applied: number }>(
      'SELECT 1 as applied FROM schema_migrations WHERE id = ?',
      migration.id,
    )

    if (alreadyApplied) {
      continue
    }

    const transaction = database.dbAsync.transaction(async () => {
      await database.dbAsync.exec(migration.sql)
      await database.dbAsync.run(
        'INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)',
        migration.id,
        new Date().toISOString(),
      )
    })

    try {
      await transaction()
    } catch (error) {
      if (!isIgnorableMigrationError(error)) {
        throw error
      }

      await database.dbAsync.run(
        'INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)',
        migration.id,
        new Date().toISOString(),
      )
    }
  }
}

function isIgnorableMigrationError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false
  }

  const message = error.message.toLowerCase()
  return message.includes('duplicate column name')
}
