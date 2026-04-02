import { Command } from 'commander'

import { WorldService } from '../../core/world/service.js'
import type { NovelDatabase } from '../../infra/db/database.js'
import { BookRepository } from '../../infra/repository/book-repository.js'
import { CharacterRepository } from '../../infra/repository/character-repository.js'
import { ChapterRepository } from '../../infra/repository/chapter-repository.js'
import { FactionRepository } from '../../infra/repository/faction-repository.js'
import { HookRepository } from '../../infra/repository/hook-repository.js'
import { ItemCurrentStateRepository } from '../../infra/repository/item-current-state-repository.js'
import { ItemRepository } from '../../infra/repository/item-repository.js'
import { LocationRepository } from '../../infra/repository/location-repository.js'
import { VolumeRepository } from '../../infra/repository/volume-repository.js'
import { openProjectDatabase } from '../context.js'

export function registerWorldCommands(program: Command): void {
  const volumeCommand = program.command('volume').description('Manage volumes')
  const characterCommand = program.command('character').description('Manage characters')
  const locationCommand = program.command('location').description('Manage locations')
  const factionCommand = program.command('faction').description('Manage factions')
  const hookCommand = program.command('hook').description('Manage hooks')
  const itemCommand = program.command('item').description('Manage items')

  volumeCommand
    .command('add')
    .description('Add a volume')
    .requiredOption('--title <title>', 'Volume title')
    .requiredOption('--goal <goal>', 'Volume goal')
    .requiredOption('--summary <summary>', 'Volume summary')
    .action(async (options) => {
      const database = await openProjectDatabase()

      try {
        const volume = createWorldService(database).addVolume({
          title: options.title,
          goal: options.goal,
          summary: options.summary,
        })

        console.log(`Volume created: ${volume.title} (${volume.id})`)
      } finally {
        database.close()
      }
    })

  characterCommand
    .command('add')
    .description('Add a character')
    .requiredOption('--name <name>', 'Character name')
    .requiredOption('--role <role>', 'Character role')
    .requiredOption('--profile <profile>', 'Character profile')
    .requiredOption('--motivation <motivation>', 'Character motivation')
    .action(async (options) => {
      const database = await openProjectDatabase()

      try {
        const character = createWorldService(database).addCharacter(options)
        console.log(`Character created: ${character.name} (${character.id})`)
      } finally {
        database.close()
      }
    })

  locationCommand
    .command('add')
    .description('Add a location')
    .requiredOption('--name <name>', 'Location name')
    .requiredOption('--type <type>', 'Location type')
    .requiredOption('--description <description>', 'Location description')
    .action(async (options) => {
      const database = await openProjectDatabase()

      try {
        const location = createWorldService(database).addLocation(options)
        console.log(`Location created: ${location.name} (${location.id})`)
      } finally {
        database.close()
      }
    })

  factionCommand
    .command('add')
    .description('Add a faction')
    .requiredOption('--name <name>', 'Faction name')
    .requiredOption('--type <type>', 'Faction type')
    .requiredOption('--objective <objective>', 'Faction objective')
    .requiredOption('--description <description>', 'Faction description')
    .action(async (options) => {
      const database = await openProjectDatabase()

      try {
        const faction = createWorldService(database).addFaction(options)
        console.log(`Faction created: ${faction.name} (${faction.id})`)
      } finally {
        database.close()
      }
    })

  hookCommand
    .command('add')
    .description('Add a hook')
    .requiredOption('--title <title>', 'Hook title')
    .requiredOption('--description <description>', 'Hook description')
    .requiredOption('--payoff-expectation <payoffExpectation>', 'Expected payoff')
    .option('--priority <priority>', 'Hook priority', 'medium')
    .option('--source-chapter-id <sourceChapterId>', 'Source chapter id')
    .action(async (options) => {
      const database = await openProjectDatabase()

      try {
        const hook = createWorldService(database).addHook({
          title: options.title,
          description: options.description,
          payoffExpectation: options.payoffExpectation,
          priority: options.priority,
          sourceChapterId: options.sourceChapterId,
        })

        console.log(`Hook created: ${hook.title} (${hook.id})`)
      } finally {
        database.close()
      }
    })

  itemCommand
    .command('add')
    .description('Add an item and initialize its current state')
    .requiredOption('--name <name>', 'Item name')
    .requiredOption('--unit <unit>', 'Item unit')
    .requiredOption('--type <type>', 'Item type')
    .requiredOption('--description <description>', 'Item description')
    .option('--quantity <number>', 'Item quantity', (value: string) => Number.parseInt(value, 10), 1)
    .option('--status <status>', 'Item state description', '正常')
    .option('--owner-character-id <ownerCharacterId>', 'Current owner character id')
    .option('--location-id <locationId>', 'Current location id')
    .option('--important', 'Mark item as important')
    .option('--unique', 'Mark item as unique worldwide')
    .action(async (options) => {
      const database = await openProjectDatabase()

      try {
        const item = createWorldService(database).addItem({
          name: options.name,
          unit: options.unit,
          type: options.type,
          description: options.description,
          quantity: options.quantity,
          status: options.status,
          ownerCharacterId: options.ownerCharacterId,
          locationId: options.locationId,
          isImportant: Boolean(options.important),
          isUniqueWorldwide: Boolean(options.unique),
        })

        console.log(`Item created: ${item.name} (${item.id})`)
      } finally {
        database.close()
      }
    })
}

function createWorldService(database: NovelDatabase): WorldService {
  return new WorldService(
    new BookRepository(database),
    new VolumeRepository(database),
    new ChapterRepository(database),
    new CharacterRepository(database),
    new LocationRepository(database),
    new FactionRepository(database),
    new HookRepository(database),
    new ItemRepository(database),
    new ItemCurrentStateRepository(database),
  )
}
