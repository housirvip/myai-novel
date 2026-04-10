import { Command } from "commander";

import { registerDbCommands } from "./commands/db.js";

export async function runCli(argv: string[]): Promise<void> {
  const program = new Command();

  program
    .name("novel")
    .description("AI novel CLI tool")
    .version("0.1.0");

  registerDbCommands(program);

  await program.parseAsync(argv);
}

