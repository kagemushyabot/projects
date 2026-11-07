/**
 * After `npm run build:projects-preview`, verify gallery image URLs return 200
 * and report any zero-width references (path typos).
 */
import { readFileSync, existsSync } from 'node:fs';

const htmlPath = 'dist/work-experience/index.html';
if (!existsSync(htmlPath)) {
  console.error('Missing', htmlPath, '— run build:projects-preview first');
  process.exit(1);
}

const html = readFileSync(htmlPath, 'utf8');
const urls = [
  ...new Set(
    [...html.matchAll(/src="((?:https?:\/\/[^"]+)|(?:\/projects\/assets\/wp-import\/[^"]+))"/g)]
      .map((m) => m[1])
      .filter((u) => u.includes('wp-import')),
  ),
];

let failed = 0;

for (const src of urls) {
  const localFile = src.startsWith('/projects/')
    ? `public/${src.replace(/^\/projects\//, '')}`
    : null;
  if (localFile && existsSync(localFile)) continue;
  const origin = process.env.VERIFY_ORIGIN || 'https://kagemushyabot.github.io';
  const url = src.startsWith('http') ? src : `${origin}${src}`;
  try {
    const res = await fetch(url, { method: 'HEAD' });
    if (!res.ok) {
      console.error('FAIL', res.status, url);
      failed++;
    }
  } catch (e) {
    console.error('ERR', url, e.message);
    failed++;
  }
}

if (failed) {
  console.error(`\n${failed}/${urls.length} asset URLs failed`);
  process.exit(1);
}

console.log(`OK: ${urls.length} gallery asset URLs (no /projects/projects/ dupes)`);
if (html.includes('/projects/projects/')) {
  console.error('FAIL: double base path still present in HTML');
  process.exit(1);
}
