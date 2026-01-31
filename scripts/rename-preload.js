import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const preloadPath = path.resolve(__dirname, '../dist/electron/preload.js');
const newPreloadPath = path.resolve(__dirname, '../dist/electron/preload.mjs');

if (fs.existsSync(preloadPath)) {
  fs.renameSync(preloadPath, newPreloadPath);
  console.log('Renamed preload.js to preload.mjs for ESM support');
} else {
  console.log('preload.js not found, skipping rename');
}