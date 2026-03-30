import { readFile, writeFile } from 'node:fs/promises';

import type { RewriteRequest } from '../../types/index.js';

export class Rewriter {
  public async rewriteDraft(draftPath: string, request: RewriteRequest): Promise<string> {
    const content = await readFile(draftPath, 'utf8');
    const rewritten = [
      content,
      '',
      '---',
      `rewrite-strategy: ${request.strategy}`,
      `length-policy: ${request.lengthPolicy ?? 'keep'}`,
      `goals: ${request.goals.join(' | ')}`,
    ].join('\n');

    await writeFile(draftPath, rewritten, 'utf8');
    return rewritten;
  }
}
