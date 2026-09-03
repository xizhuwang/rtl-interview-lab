// Download only for local/CI testing. Never include .engine-cache in a release.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { icarusBase, icarusFiles } from '../public/engine/runtime-manifest.js';
const cache = new URL('../.engine-cache/', import.meta.url);
await mkdir(cache, { recursive: true });
for (const [name, expected] of Object.entries(icarusFiles)) {
  const target = new URL(name, cache);
  let bytes;
  try { bytes = await readFile(target); } catch { /* Download below. */ }
  const hash = (data) => createHash('sha256').update(data).digest('hex');
  if (bytes && hash(bytes) === expected) continue;
  const response = await fetch(icarusBase + name);
  if (!response.ok) throw new Error(`Download failed: ${name}, HTTP ${response.status}`);
  bytes = Buffer.from(await response.arrayBuffer());
  if (hash(bytes) !== expected) throw new Error(`Integrity mismatch: ${name}`);
  await writeFile(target, bytes);
}
console.log('Verified all six upstream compiler assets in local-only cache.');
