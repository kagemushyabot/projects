import puppeteer from 'puppeteer-core';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const outDir = process.argv[2];
const baseUrl =
  process.argv[3] ?? 'https://kagemushyabot.github.io/projects/work-experience/?v=' + Date.now();

if (!outDir) {
  console.error('usage: node scripts/capture-work-exp-batch.mjs <outDir> [baseUrl]');
  process.exit(1);
}

await mkdir(outDir, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: '/usr/local/bin/google-chrome',
  headless: true,
  args: ['--no-sandbox', '--disable-gpu', `--user-data-dir=/tmp/pptr-batch-${process.pid}`],
});

const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
await page.goto(baseUrl, { waitUntil: 'networkidle2', timeout: 90000 });
await page.evaluate(() => document.querySelectorAll('.reveal').forEach((el) => el.classList.add('is-visible')));

const waitDecoded = async (selector) => {
  await page.evaluate(async (sel) => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const img = document.querySelector(sel);
    if (!img) return;
    const deadline = Date.now() + 4000;
    while (Date.now() < deadline) {
      if (img.complete && img.naturalWidth > 0) {
        const ok = await img.decode?.().catch(() => true);
        if (ok !== false) return;
      }
      await sleep(120);
    }
  }, selector);
};

const rectVis = async (selector) =>
  page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    const visible =
      r.width > 8 &&
      r.height > 8 &&
      style.visibility !== 'hidden' &&
      style.display !== 'none' &&
      parseFloat(style.opacity || '1') > 0.05;
    const img = el.tagName === 'IMG' ? el : el.querySelector('img');
    return {
      box: { w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.x), y: Math.round(r.y) },
      visible,
      natural: img ? { w: img.naturalWidth, h: img.naturalHeight } : null,
    };
  }, selector);

// Keynote + Evil Eye spotlight
await page.evaluate(() => {
  document.getElementById('google-next-opening-keynote-2017')?.scrollIntoView({ block: 'start' });
});
await waitDecoded('#google-next-opening-keynote-2017 .gallery-still-open img, #google-next-opening-keynote-2017 img');
await new Promise((r) => setTimeout(r, 350));
await page.evaluate(() => {
  const evil = document.getElementById('evil-eye-pictures-san-francisco');
  evil?.scrollIntoView({ block: 'nearest' });
});
await waitDecoded('.gallery-evil-eye-spotlight-band img');
await new Promise((r) => setTimeout(r, 400));
await page.screenshot({
  path: path.join(outDir, 'work-exp-keynote-spotlight-desktop.png'),
  clip: await page.evaluate(() => {
    const kn = document.getElementById('google-next-opening-keynote-2017');
    const evil = document.getElementById('evil-eye-pictures-san-francisco');
    if (!kn || !evil) return { x: 0, y: 0, width: 1440, height: 600 };
    const r1 = kn.getBoundingClientRect();
    const r2 = evil.getBoundingClientRect();
    const top = Math.min(r1.top, r2.top) - 12;
    const bottom = Math.max(r1.bottom, r2.top + Math.min(r2.height, 420)) + 12;
    return { x: 0, y: Math.max(0, top), width: 1440, height: Math.min(900, bottom - Math.max(0, top)) };
  }),
});

// Mission / Marvel / Float rows
await page.evaluate(() =>
  document.getElementById('mission-to-the-deep-exhibit')?.scrollIntoView({ block: 'start' }),
);
await waitDecoded('#mission-to-the-deep-exhibit img');
await waitDecoded('#marvel-mighty-heroes-mobile-game img');
await waitDecoded('#floathybrid-entertainment-sf img');
await new Promise((r) => setTimeout(r, 450));
await page.screenshot({
  path: path.join(outDir, 'work-exp-mission-marvel-float-row.png'),
  clip: await page.evaluate(() => {
    const m = document.getElementById('mission-to-the-deep-exhibit');
    const mar = document.getElementById('marvel-mighty-heroes-mobile-game');
    const f = document.getElementById('floathybrid-entertainment-sf');
    const rects = [m, mar, f].filter(Boolean).map((el) => el.getBoundingClientRect());
    const top = Math.min(...rects.map((r) => r.top)) - 16;
    const bottom = Math.max(...rects.map((r) => r.bottom)) + 16;
    return { x: 0, y: Math.max(0, top), width: 1440, height: Math.min(900, bottom - Math.max(0, top)) };
  }),
});

// Lightbox open
await page.evaluate(() => document.getElementById('facebook-spaces')?.scrollIntoView({ block: 'center' }));
await waitDecoded('#facebook-spaces .gallery-still-open img');
await new Promise((r) => setTimeout(r, 300));
await page.click('#facebook-spaces [data-image-open]');
await page.waitForFunction(
  () => !document.querySelector('[data-image-modal]')?.hasAttribute('hidden'),
  { timeout: 5000 },
);
await new Promise((r) => setTimeout(r, 400));
await page.screenshot({
  path: path.join(outDir, 'work-exp-image-lightbox-open.png'),
  fullPage: false,
});
await page.keyboard.press('Escape');

// Mobile
await page.setViewport({ width: 390, height: 844 });
await page.goto(baseUrl, { waitUntil: 'networkidle2', timeout: 90000 });
await page.evaluate(() => document.querySelectorAll('.reveal').forEach((el) => el.classList.add('is-visible')));
await page.evaluate(() =>
  document.getElementById('evil-eye-pictures-san-francisco')?.scrollIntoView({ block: 'start' }),
);
await waitDecoded('.gallery-evil-eye-spotlight-band img');
await new Promise((r) => setTimeout(r, 500));
await page.screenshot({
  path: path.join(outDir, 'work-exp-mobile-layout.png'),
  fullPage: false,
});

const rowMetrics = await page.evaluate(() => {
  const rect = (id) => {
    const el = document.getElementById(id);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { y: Math.round(r.y), h: Math.round(r.height), solo: el.classList.contains('gallery-item--solo-row') };
  };
  const evil = document.getElementById('evil-eye-pictures-san-francisco');
  const spot = evil?.querySelector('.gallery-evil-eye-spotlight-band img');
  const pearl = evil?.querySelector('.gallery-evil-eye-pair--pearl img');
  const spotR = spot?.getBoundingClientRect();
  const pearlR = pearl?.getBoundingClientRect();
  const marvelBtn = document.querySelector('#marvel-mighty-heroes-mobile-game [data-video-open]');
  return {
    soloRows: ['mission-to-the-deep-exhibit', 'marvel-mighty-heroes-mobile-game', 'floathybrid-entertainment-sf'].map(
      rect,
    ),
    spotlightAbovePearl: spotR && pearlR ? spotR.bottom <= pearlR.top + 4 : null,
    marvelYoutubeId: marvelBtn?.getAttribute('data-youtube-id'),
    overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    myvrPresent: Boolean(document.getElementById('myvr-app')),
  };
});

await page.setViewport({ width: 1440, height: 900 });
const keynoteStill = await rectVis('#google-next-opening-keynote-2017 .gallery-still-open');
const spotlightStill = await rectVis('.gallery-evil-eye-spotlight-band img');

const metrics = {
  baseUrl,
  capturedAt: new Date().toISOString(),
  keynoteStill,
  spotlightStill,
  rowMetrics,
};

await writeFile(path.join(outDir, 'work-exp-layout-batch-metrics.json'), JSON.stringify(metrics, null, 2));
await browser.close();

const pass =
  !rowMetrics.myvrPresent &&
  rowMetrics.marvelYoutubeId === 'DjZyFg5CHIs' &&
  rowMetrics.spotlightAbovePearl &&
  !rowMetrics.overflowX &&
  keynoteStill?.visible &&
  spotlightStill?.visible;

console.log(JSON.stringify({ pass, metrics }, null, 2));
process.exit(pass ? 0 : 1);
