export class NovelError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'NovelError'
  }
}

export function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  return 'Unknown error'
}
