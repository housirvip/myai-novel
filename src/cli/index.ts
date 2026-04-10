import { Command } from "commander";

import { registerApproveCommands } from "./commands/approve.js";
import { registerBookCommands } from "./commands/book.js";
import { registerChapterCommands } from "./commands/chapter.js";
import { registerCharacterCommands } from "./commands/character.js";
import { registerDbCommands } from "./commands/db.js";
import { registerDraftCommands } from "./commands/draft.js";
import { registerFactionCommands } from "./commands/faction.js";
import { registerHookCommands } from "./commands/hook.js";
import { registerItemCommands } from "./commands/item.js";
import { registerOutlineCommands } from "./commands/outline.js";
import { registerPlanCommands } from "./commands/plan.js";
import { registerRepairCommands } from "./commands/repair.js";
import { registerRelationCommands } from "./commands/relation.js";
import { registerReviewCommands } from "./commands/review.js";
import { registerWorldCommands } from "./commands/world.js";

export async function runCli(argv: string[]): Promise<void> {
  const program = new Command();

  program
    .name("novel")
    .description("AI novel CLI tool")
    .version("0.1.0");

  registerApproveCommands(program);
  registerBookCommands(program);
  registerOutlineCommands(program);
  registerWorldCommands(program);
  registerCharacterCommands(program);
  registerFactionCommands(program);
  registerRelationCommands(program);
  registerItemCommands(program);
  registerHookCommands(program);
  registerChapterCommands(program);
  registerPlanCommands(program);
  registerDraftCommands(program);
  registerRepairCommands(program);
  registerReviewCommands(program);
  registerDbCommands(program);

  await program.parseAsync(argv);
}
