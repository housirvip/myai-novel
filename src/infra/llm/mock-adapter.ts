import type { GenerateResult, LlmAdapter, PromptInput } from './types.js';

export class MockLlmAdapter implements LlmAdapter {
  public async generateText(input: PromptInput): Promise<GenerateResult> {
    const text = [
      '# Mock Draft',
      '',
      `system: ${input.system}`,
      '',
      `user: ${input.user}`,
    ].join('\n');

    return {
      text,
      usage: {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
      },
      raw: { provider: 'mock' },
    };
  }

  public async generateStructured<T>(_input: PromptInput, schemaName: string): Promise<T> {
    throw new Error(`Mock adapter does not implement structured generation for schema: ${schemaName}`);
  }
}
