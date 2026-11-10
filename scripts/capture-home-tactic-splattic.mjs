import puppeteer from 'puppeteer-core';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const outDir = process.argv[2];
const homeUrl = process.argv[3];
const sha = process.argv[4] || 'local';

if (!outDir || !homeUrl) {
  console.error('usage: npx vite-node scripts/capture-home-tactic-splattic.mjs <outDir> <homeUrl> [sha]');
  process.exit(1);
}

await mkdir(outDir, { recursive: true });

const TARGETS = [
  { id: 'tactic-studio-featured', needle: 'tactic-studio-featured', filename: `home-full-tactic-${sha}.png` },
  { id: 'splattic-featured', needle: 'splattic-featured', filename: `home-full-splattic-${sha}.png` },
];

const browser = await puppeteer.launch({
  executablePath: '/usr/local/bin/google-chrome',
  headless: true,
  args: ['--no-sandbox', '--disable-gpu', `--user-data-dir=/tmp/pptr-tactic-${process.pid}`],
});

const page = await browser.newPage();
await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
await page.goto(homeUrl, { waitUntil: 'networkidle2', timeout: 120000 });
await page.evaluate(() => document.querySelectorAll('.reveal').forEach((n) => n.classList.add('is-visible')));

const seenSrcs = new Set();
const shots = {};
const deadline = Date.now() + 22_000;

while (Date.now() < deadline) {
  const src = await page.evaluate(() => document.querySelector('[data-slideshow-img]')?.src || '');
  if (src) seenSrcs.add(src);
  for (const t of TARGETS) {
    if (!shots[t.id] && src.includes(t.needle)) {
      await page.screenshot({ path: path.join(outDir, t.filename), fullPage: true });
      shots[t.id] = src;
    }
  }
  if (Object.keys(shots).length === TARGETS.length) break;
  await new Promise((r) => setTimeout(r, 350));
}

await browser.close();

const metrics = {
  homeUrl,
  deploySha: sha,
  capturedAt: new Date().toISOString(),
  assetUrls: {
    tactic: '/assets/work-intro/tactic-studio-featured.png',
    splattic: '/assets/work-intro/splattic-featured.png',
  },
  panelIds: ['work-intro-tactic-studio-featured', 'work-intro-splattic-featured'],
  observedSrcs: [...seenSrcs],
  shots,
  selfCheck: {
    sawTactic: !!shots['tactic-studio-featured'],
    sawSplattic: !!shots['splattic-featured'],
    noYoutube: [...seenSrcs].every((s) => !s.includes('img.youtube.com')),
    pass: !!shots['tactic-studio-featured'] && !!shots['splattic-featured'],
  },
};

await writeFile(path.join(outDir, `home-tactic-splattic-metrics-${sha}.json`), JSON.stringify(metrics, null, 2));
console.log(JSON.stringify(metrics, null, 2));
process.exit(metrics.selfCheck.pass ? 0 : 1);
