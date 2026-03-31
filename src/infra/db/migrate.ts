import type { NovelDatabase } from './database.js'
import { migrations } from './schema.js'

export function runMigrations(database: NovelDatabase): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `)

  const hasMigration = database.prepare('SELECT 1 FROM schema_migrations WHERE id = ?').pluck()
  const insertMigration = database.prepare(
    'INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)',
  )

  for (const migration of migrations) {
    const alreadyApplied = hasMigration.get(migration.id)

    if (alreadyApplied) {
      continue
    }

    const transaction = database.transaction(() => {
      database.exec(migration.sql)
      insertMigration.run(migration.id, new Date().toISOString())
    })

    transaction()
  }
}
