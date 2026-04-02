import path from 'node:path'

import { openDatabase, type NovelDatabase } from '../infra/db/database.js'
import { runMigrations } from '../infra/db/migrate.js'
import { readProjectConfig } from '../shared/utils/project-paths.js'

export async function openProjectDatabase(): Promise<NovelDatabase> {
  const rootDir = process.cwd()
  const config = await readProjectConfig(rootDir)
  const databasePath = path.resolve(rootDir, config.database.filename)
  const database = openDatabase(databasePath)

  runMigrations(database)

  return database
}

export function parseInteger(value: string): number {
  const parsed = Number.parseInt(value, 10)

  if (Number.isNaN(parsed)) {
    throw new Error(`Invalid integer: ${value}`)
  }

  return parsed
}

export function parseFloatNumber(value: string): number {
  const parsed = Number.parseFloat(value)

  if (Number.isNaN(parsed)) {
    throw new Error(`Invalid number: ${value}`)
  }

  return parsed
}
