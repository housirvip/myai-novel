import assert from 'node:assert/strict'
import test from 'node:test'

import { openDatabase } from '../../../../src/infra/db/database.js'
import { runMigrations } from '../../../../src/infra/db/migrate.js'
import { migrations } from '../../../../src/infra/db/schema.js'
import { withTempDir } from '../../../helpers/fs.js'

test('openDatabase opens a sqlite database with foreign keys enabled', async () => {
  await withTempDir(async (rootDir) => {
    const database = openDatabase(`${rootDir}/novel.sqlite`)

    try {
      assert.equal(database.client, 'sqlite')
      const pragma = database.db.get<{ foreign_keys: number }>('PRAGMA foreign_keys')
      assert.equal(pragma?.foreign_keys, 1)
    } finally {
      database.close()
    }
  })
})

test('runMigrations is idempotent and records every migration once', async () => {
  await withTempDir(async (rootDir) => {
    const database = openDatabase(`${rootDir}/novel.sqlite`)

    try {
      await runMigrations(database)
      await runMigrations(database)

      const count = await database.dbAsync.get<{ count: number }>('SELECT COUNT(*) as count FROM schema_migrations')
      assert.equal(count?.count, migrations.length)
    } finally {
      database.close()
    }
  })
})

test('sqlite async transactions roll back on failure', async () => {
  await withTempDir(async (rootDir) => {
    const database = openDatabase(`${rootDir}/novel.sqlite`)

    try {
      await database.dbAsync.exec('CREATE TABLE tx_test (value INTEGER NOT NULL)')

      const transaction = database.dbAsync.transaction(async (value: number) => {
        await database.dbAsync.run('INSERT INTO tx_test (value) VALUES (?)', value)
        throw new Error('rollback please')
      })

      await assert.rejects(() => transaction(1), /rollback please/)

      const count = await database.dbAsync.get<{ count: number }>('SELECT COUNT(*) as count FROM tx_test')
      assert.equal(count?.count, 0)
    } finally {
      database.close()
    }
  })
})