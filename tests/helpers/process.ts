/**
 * Temporarily switches the current working directory for the duration of a test.
 */
export async function withCwd<T>(cwd: string, run: () => T | Promise<T>): Promise<T> {
  const previousCwd = process.cwd()
  process.chdir(cwd)

  try {
    return await run()
  } finally {
    process.chdir(previousCwd)
  }
}