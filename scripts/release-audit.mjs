import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import assert from 'node:assert/strict';
const tracked = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean).filter(existsSync);
const patterns = [
  /(?:ghp_|github_pat_|sk-proj-)[A-Za-z0-9_]{16,}/,
  /-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----/,
  /[A-Za-z0-9.+_-]+@(?:gmail|hotmail|outlook|yahoo)\.[A-Za-z.]+/i,
  /\b09\d{2}[- ]?\d{3}[- ]?\d{3}\b/,
  /[A-Z]:[\\/]Users[\\/]/i,
];
for (const file of tracked) {
  assert.ok(!/\.(pdf|docx?|m4a|mp3|wav|gds|oas|ndm|db|lib|lef|wasm)$/i.test(file), `Review restricted artifact: ${file}`);
  if (/^public\/engine\/(?:ivl|ivlpp|vvp)\.js$/.test(file)) throw new Error('Do not redistribute unverified compiler build assets');
  const text = readFileSync(file, 'utf8');
  // The audit source necessarily contains the detection patterns itself.
  if (file !== 'scripts/release-audit.mjs') for (const pattern of patterns) assert.ok(!pattern.test(text), `Sensitive content detected in ${file}`);
}
const page = readFileSync('app/page.tsx', 'utf8');
assert.ok(!/hdlbits|leetcode/i.test(page));
assert.ok(existsSync('gh-pages/OPEN_SOURCE_LICENSES.txt'));
assert.ok(!readdirSync('gh-pages/engine').some(n => /\.wasm$|^(ivl|ivlpp|vvp)\.js$/.test(n)));
console.log(`Release audit passed: ${tracked.length} source files, no private contact details or restricted artifacts found. Manual provenance review is still required.`);
