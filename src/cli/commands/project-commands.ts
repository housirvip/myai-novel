import { Command } from 'commander'

import { BookService } from '../../core/book/service.js'
import { openDatabase } from '../../infra/db/database.js'
import { runMigrations } from '../../infra/db/migrate.js'
import { BookRepository } from '../../infra/repository/book-repository.js'
import { ChapterRepository } from '../../infra/repository/chapter-repository.js'
import { OutlineRepository } from '../../infra/repository/outline-repository.js'
import { VolumeRepository } from '../../infra/repository/volume-repository.js'
import { NovelError } from '../../shared/utils/errors.js'
import { formatList } from '../../shared/utils/format.js'
import {
  ensureProjectDirectories,
  resolveProjectPaths,
  writeProjectConfig,
} from '../../shared/utils/project-paths.js'
import { openProjectDatabase, parseFloatNumber, parseInteger } from '../context.js'

export function registerProjectCommands(program: Command): void {
  registerInitCommand(program)

  const outlineCommand = program.command('outline').description('Manage outline data')
  const bookCommand = program.command('book').description('Manage book data')

  outlineCommand
    .command('set')
    .description('Set the book outline')
    .requiredOption('--premise <premise>', 'Story premise')
    .requiredOption('--theme <theme>', 'Story theme')
    .requiredOption('--worldview <worldview>', 'Worldview description')
    .requiredOption('--core-conflict <items...>', 'One or more core conflicts')
    .requiredOption('--ending-vision <endingVision>', 'Desired ending direction')
    .action(async (options) => {
      const database = await openProjectDatabase()

      try {
        const bookService = new BookService(
          new BookRepository(database),
          new OutlineRepository(database),
        )

        const outline = bookService.setOutline({
          premise: options.premise,
          theme: options.theme,
          worldview: options.worldview,
          coreConflicts: options.coreConflict,
          endingVision: options.endingVision,
        })

        console.log(`Outline saved for book: ${outline.bookId}`)
      } finally {
        database.close()
      }
    })

  bookCommand
    .command('show')
    .description('Show the current book and outline')
    .action(async () => {
      const database = await openProjectDatabase()

      try {
        const bookRepository = new BookRepository(database)
        const outlineRepository = new OutlineRepository(database)
        const volumeRepository = new VolumeRepository(database)
        const chapterRepository = new ChapterRepository(database)
        const book = bookRepository.getFirst()

        if (!book) {
          throw new NovelError('Project is not initialized. Run `novel init` first.')
        }

        const outline = outlineRepository.getByBookId(book.id)
        const volumes = volumeRepository.listByBookId(book.id)
        const chapters = chapterRepository.listByBookId(book.id)

        console.log(`Book: ${book.title}`)
        console.log(`ID: ${book.id}`)
        console.log(`Genre: ${book.genre}`)
        console.log(`Default chapter words: ${book.defaultChapterWordCount}`)
        console.log(`Tolerance ratio: ${book.chapterWordCountToleranceRatio}`)
        console.log(`Volumes: ${volumes.length}`)
        console.log(`Chapters: ${chapters.length}`)

        if (outline) {
          console.log(`Premise: ${outline.premise}`)
          console.log(formatList('Core conflicts', outline.coreConflicts))
        }
      } finally {
        database.close()
      }
    })
}

function registerInitCommand(program: Command): void {
  program
    .command('init')
    .description('Initialize a new novel project in the current directory')
    .requiredOption('--title <title>', 'Book title')
    .requiredOption('--genre <genre>', 'Book genre')
    .option('--word-count <number>', 'Default chapter word count', parseInteger, 3000)
    .option('--tolerance <number>', 'Chapter word count tolerance ratio', parseFloatNumber, 0.15)
    .option('--db-client <client>', 'Database client: sqlite or mysql', 'sqlite')
    .option('--db-filename <filename>', 'SQLite database filename', 'data/novel.sqlite')
    .option('--db-host <host>', 'MySQL host', '127.0.0.1')
    .option('--db-port <port>', 'MySQL port', parseInteger, 3306)
    .option('--db-user <user>', 'MySQL user', 'root')
    .option('--db-password <password>', 'MySQL password')
    .option('--db-name <name>', 'MySQL database name', 'myai_novel')
    .action(async (options) => {
      const paths = resolveProjectPaths(process.cwd())
      const databaseConfig = buildInitDatabaseConfig(options)

      await ensureProjectDirectories(paths)
      await writeProjectConfig(paths, {
        database: databaseConfig,
      })

      const database = openDatabase(
        databaseConfig.client === 'sqlite'
          ? {
              ...databaseConfig,
              filename: paths.databaseFilePath,
            }
          : databaseConfig,
      )

      try {
        runMigrations(database)

        const bookService = new BookService(
          new BookRepository(database),
          new OutlineRepository(database),
        )

        const book = bookService.initializeBook({
          title: options.title,
          genre: options.genre,
          defaultChapterWordCount: options.wordCount,
          chapterWordCountToleranceRatio: options.tolerance,
        })

        console.log(`Initialized novel project: ${book.title} (${book.id})`)
        console.log(
          `Database: ${databaseConfig.client === 'sqlite' ? paths.databaseFilePath : `${databaseConfig.host}:${databaseConfig.port}/${databaseConfig.database}`}`,
        )
      } finally {
        database.close()
      }
    })
}

function buildInitDatabaseConfig(options: {
  dbClient: string
  dbFilename: string
  dbHost: string
  dbPort: number
  dbUser: string
  dbPassword?: string
  dbName: string
}): {
  client: 'sqlite'
  filename: string
} | {
  client: 'mysql'
  host: string
  port: number
  user: string
  password?: string
  database: string
} {
  if (options.dbClient === 'mysql') {
    return {
      client: 'mysql',
      host: options.dbHost,
      port: options.dbPort,
      user: options.dbUser,
      password: options.dbPassword,
      database: options.dbName,
    }
  }

  return {
    client: 'sqlite',
    filename: options.dbFilename,
  }
}
