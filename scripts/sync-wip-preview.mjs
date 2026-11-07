/**
 * Build WIP home without portfolio assets and sync into wip-preview/ for Cursor publish (<50MB pack).
 * Run from repo root: node scripts/sync-wip-preview.mjs
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');
const preview = path.join(root, 'wip-preview');
const wpImport = path.join(root, 'public', 'assets', 'wp-import');
const stash = path.join(root, '.wip-preview-stash-wp-import');

function copyRecursive(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const name of fs.readdirSync(src)) {
    const s = path.join(src, name);
    const d = path.join(dest, name);
    if (fs.statSync(s).isDirectory()) {
      copyRecursive(s, d);
    } else {
      fs.copyFileSync(s, d);
    }
  }
}

let stashed = false;
if (fs.existsSync(wpImport)) {
  if (fs.existsSync(stash)) {
    console.error('Stale stash exists; remove .wip-preview-stash-wp-import and retry.');
    process.exit(1);
  }
  fs.renameSync(wpImport, stash);
  stashed = true;
}

try {
  execSync('npm run build', {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, PUBLIC_SITE_LAUNCH: 'false' },
  });
} finally {
  if (stashed && fs.existsSync(stash)) {
    fs.renameSync(stash, wpImport);
  }
}

if (!fs.existsSync(path.join(dist, 'index.html'))) {
  console.error('dist/index.html missing after build');
  process.exit(1);
}

const hero = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
if (!hero.includes('準備中') || !hero.includes('noindex')) {
  console.error('Build is not WIP home; aborting sync.');
  process.exit(1);
}

fs.rmSync(preview, { recursive: true, force: true });
fs.mkdirSync(preview, { recursive: true });

for (const name of ['index.html', 'favicon.svg', 'favicon.ico']) {
  const src = path.join(dist, name);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(preview, name));
  }
}

const astroDir = path.join(dist, '_astro');
if (fs.existsSync(astroDir)) {
  copyRecursive(astroDir, path.join(preview, '_astro'));
}

const readme = `# WIP home preview (Cursor publish)

Static slice of the Astro site for hosted preview under the 50MB pack limit. Omits \`public/assets/wp-import/\`.

Refresh after source changes:

\`\`\`bash
node scripts/sync-wip-preview.mjs
\`\`\`

Then commit \`wip-preview/\` and republish via Cursor.
`;

fs.writeFileSync(path.join(preview, 'README.md'), readme);
console.log(`Synced WIP preview to ${preview}`);
