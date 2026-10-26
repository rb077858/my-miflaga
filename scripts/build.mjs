// בניית צד הלקוח: העתקת גופנים, איגוד JavaScript עם esbuild (כולל פיצול קוד), וקובץ גרסה לשבירת מטמון.
import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const out = join(root, 'public/assets/js');
const fontsOut = join(root, 'public/assets/fonts');
const watch = process.argv.includes('--watch');

mkdirSync(fontsOut, { recursive: true });
const fontSources = [
  ['@fontsource/rubik/files', /^rubik-(hebrew|latin)-(400|500|700|900)-normal\.woff2$/],
  ['@fontsource/frank-ruhl-libre/files', /^frank-ruhl-libre-(hebrew|latin)-(700|900)-normal\.woff2$/],
];
for (const [dir, re] of fontSources) {
  const full = join(root, 'node_modules', dir);
  if (!existsSync(full)) continue;
  for (const f of readdirSync(full)) if (re.test(f)) cpSync(join(full, f), join(fontsOut, f));
}

rmSync(out, { recursive: true, force: true });
const options = {
  entryPoints: {
    site: 'src/client/site.js',
    home: 'src/client/pages/home.js',
    party: 'src/client/pages/party.js',
    app: 'src/client/pages/app.js',
    admin: 'src/client/pages/admin.js',
    callback: 'src/client/pages/callback.js',
  },
  absWorkingDir: root,
  bundle: true,
  splitting: true,
  format: 'esm',
  target: ['es2020'],
  outdir: out,
  minify: !watch,
  sourcemap: watch ? 'inline' : false,
  chunkNames: 'chunks/[name]-[hash]',
  logLevel: 'info',
};
await build(options);
await build({
  entryPoints: { theme: 'src/client/theme.js' }, absWorkingDir: root, bundle: true, format: 'iife', outdir: out, minify: true, logLevel: 'info',
});

// גרסת נכסים לפי תוכן הקבצים
const hash = createHash('sha256');
const walk = (dir) => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p); else hash.update(readFileSync(p));
  }
};
walk(join(root, 'public/assets'));
const version = hash.digest('hex').slice(0, 10);
writeFileSync(join(root, 'src/worker/version.js'), `// נוצר אוטומטית ב-npm run build\nexport const ASSET_VERSION = '${version}';\n`);
console.log('asset version', version);
