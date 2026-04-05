import type { NovelDatabase } from './database.js'
import { migrations } from './schema.js'
import { isSqliteDatabase } from './sqlite-support.js'

export function runMigrations(database: NovelDatabase): void {
  if (!isSqliteDatabase(database)) {
    throw new Error('MySQL backend is configured, but migration execution is not wired yet in v5.')
  }

  database.db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `)

  for (const migration of migrations) {
    const alreadyApplied = database.db.get<{ exists: number }>(
      'SELECT 1 as exists FROM schema_migrations WHERE id = ?',
      migration.id,
    )

    if (alreadyApplied) {
      continue
    }

    const transaction = database.db.transaction(() => {
      database.db.exec(migration.sql)
      database.db.run(
        'INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)',
        migration.id,
        new Date().toISOString(),
      )
    })

    transaction()
  }
}
