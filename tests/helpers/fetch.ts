/**
 * Temporarily replaces the global fetch implementation for the duration of a test.
 */
export async function withMockFetch<T>(
  implementation: typeof fetch,
  run: () => T | Promise<T>,
): Promise<T> {
  const originalFetch = globalThis.fetch
  globalThis.fetch = implementation

  try {
    return await run()
  } finally {
    globalThis.fetch = originalFetch
  }
}