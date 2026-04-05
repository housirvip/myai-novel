type EnvOverrides = Record<string, string | undefined>

/**
 * Temporarily applies environment variable overrides for the duration of a test
 * and restores the previous process environment afterwards.
 */
export async function withEnv<T>(overrides: EnvOverrides, run: () => T | Promise<T>): Promise<T> {
  const previousValues = new Map<string, string | undefined>()

  for (const [key, value] of Object.entries(overrides)) {
    previousValues.set(key, process.env[key])

    if (value === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = value
    }
  }

  try {
    return await run()
  } finally {
    for (const [key, value] of previousValues.entries()) {
      if (value === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = value
      }
    }
  }
}