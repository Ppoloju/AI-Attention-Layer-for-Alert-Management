import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

/**
 * Load the monorepo root `.env` so frontend and backend share one config file.
 * Searches upward from cwd for the first `.env` found.
 */
export function loadRootEnv(): string | null {
  let dir = process.cwd();

  for (let i = 0; i < 4; i++) {
    const envPath = path.join(dir, '.env');
    if (fs.existsSync(envPath)) {
      dotenv.config({ path: envPath });
      return envPath;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  return null;
}
