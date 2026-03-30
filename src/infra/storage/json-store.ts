import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export class JsonStore {
  public async read<T>(path: string): Promise<T> {
    const content = await readFile(path, 'utf8');
    return JSON.parse(content) as T;
  }

  public async write<T>(path: string, value: T): Promise<void> {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, JSON.stringify(value, null, 2) + '\n', 'utf8');
  }

  public async exists(path: string): Promise<boolean> {
    try {
      await readFile(path, 'utf8');
      return true;
    } catch {
      return false;
    }
  }
}
