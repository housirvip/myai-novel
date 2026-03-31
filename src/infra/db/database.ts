import Database from 'better-sqlite3'

export type NovelDatabase = Database.Database

export function openDatabase(filename: string): NovelDatabase {
  const database = new Database(filename)

  database.pragma('journal_mode = WAL')
  database.pragma('foreign_keys = ON')

  return database
}
