import type { NovelDatabase } from './database.js'
import { migrations } from './schema.js'
import { assertSqliteDatabase } from './sqlite-support.js'

export function runMigrations(database: NovelDatabase): void {
  const sqlite = assertSqliteDatabase(database)

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `)

  const hasMigration = sqlite.prepare('SELECT 1 FROM schema_migrations WHERE id = ?').pluck()
  const insertMigration = sqlite.prepare(
    'INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)',
  )

  for (const migration of migrations) {
    const alreadyApplied = hasMigration.get(migration.id)

    if (alreadyApplied) {
      continue
    }

    const transaction = sqlite.transaction(() => {
      sqlite.exec(migration.sql)
      insertMigration.run(migration.id, new Date().toISOString())
    })

    transaction()
  }
}
