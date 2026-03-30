import { readFile } from 'node:fs/promises';

import type { ReviewReport } from '../../types/index.js';

export class Reviewer {
  public async reviewDraft(draftPath: string, targetWordCount: number, toleranceRatio: number): Promise<ReviewReport> {
    const content = await readFile(draftPath, 'utf8');
    const actual = content.length;
    const deviationRatio = targetWordCount === 0 ? 0 : Math.abs(actual - targetWordCount) / targetWordCount;

    return {
      consistencyIssues: [],
      characterIssues: [],
      pacingIssues: [],
      hookIssues: [],
      wordCountCheck: {
        target: targetWordCount,
        actual,
        toleranceRatio,
        deviationRatio,
        passed: deviationRatio <= toleranceRatio,
      },
      revisionAdvice: deviationRatio <= toleranceRatio ? [] : ['字数偏差过大，建议执行长度修正'],
    };
  }
}
