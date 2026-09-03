import { icarusBase, icarusFiles } from './runtime-manifest.js';

async function verifiedAsset(name) {
  const response = await fetch(icarusBase + name, { credentials: 'omit', referrerPolicy: 'no-referrer' });
  if (!response.ok) throw new Error(`Compiler download failed: ${response.status}. Check your connection and retry.`);
  const bytes = await response.arrayBuffer();
  const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2, '0')).join('');
  if (digest !== icarusFiles[name]) throw new Error(`Compiler integrity check failed: ${name}. Execution stopped.`);
  return bytes;
}

export async function loadIcarus() {
  // The Node regression adapter injects the same hash-checked upstream modules.
  if (globalThis.__SOC_RTL_TEST_FACTORIES__) return globalThis.__SOC_RTL_TEST_FACTORIES__;
  const entries = await Promise.all([
    ['initIvlpp', 'ivlpp'], ['initIvl', 'ivl'], ['initVvp', 'vvp'],
  ].map(async ([key, name]) => {
    const [js, wasmBinary] = await Promise.all([verifiedAsset(name + '.js'), verifiedAsset(name + '.wasm')]);
    // Emscripten resolves URLs relative to import.meta.url, which blob: lacks.
    // Adapt only that base after verifying the unmodified upstream bytes.
    const source = new TextDecoder().decode(js).replaceAll('import.meta.url', JSON.stringify(icarusBase + name + '.js'));
    const url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
    const { default: initialize } = await import(url);
    URL.revokeObjectURL(url);
    return [key, (options) => initialize({ ...options, wasmBinary })];
  }));
  return Object.fromEntries(entries);
}
