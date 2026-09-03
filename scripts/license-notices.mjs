import fs from 'node:fs';
import path from 'node:path';

// Generate notices for packages actually included in the browser bundle.
export function licenseNotices() {
  return {
    name: 'runtime-license-notices',
    generateBundle() {
      const packages = new Map();
      for (const id of this.getModuleIds()) {
        if (!id.includes('node_modules') || id.startsWith('\0')) continue;
        let dir = path.dirname(id.split('?')[0]);
        while (dir.includes('node_modules')) {
          const json = path.join(dir, 'package.json');
          if (fs.existsSync(json)) {
            const pkg = JSON.parse(fs.readFileSync(json, 'utf8'));
            const names = fs.readdirSync(dir).filter(n => /^(licen[sc]e|copying|notice)(\.|$)/i.test(n) && fs.statSync(path.join(dir, n)).isFile());
            if (!names.length) this.error(`Missing runtime license: ${pkg.name}. Review before publishing.`);
            packages.set(`${pkg.name}@${pkg.version}`, names.map(n => fs.readFileSync(path.join(dir, n), 'utf8')).join('\n'));
            break;
          }
          dir = path.dirname(dir);
        }
      }
      const notices = [...packages].sort(([a], [b]) => a.localeCompare(b)).map(([name, license]) => `${'='.repeat(72)}\n${name}\n${'='.repeat(72)}\n${license}`).join('\n\n');
      this.emitFile({ type: 'asset', fileName: 'OPEN_SOURCE_LICENSES.txt', source: notices });
    },
  };
}
