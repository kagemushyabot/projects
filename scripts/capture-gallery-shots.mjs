import puppeteer from 'puppeteer-core';
import { mkdir } from 'node:fs/promises';

const outDir = process.argv[2];
const origin = process.env.PREVIEW_ORIGIN || 'http://127.0.0.1:4321';
const basePath =
  process.env.PREVIEW_BASE_PATH ||
  (await fetch(`${origin}/projects/work-experience/`).then((r) => (r.ok ? '/projects/work-experience/' : '/work-experience/')));
const base = `${origin}${basePath}`;

await mkdir(outDir, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: '/usr/local/bin/google-chrome',
  headless: true,
  args: ['--no-sandbox', '--disable-gpu', '--user-data-dir=/tmp/pptr-gallery'],
});

const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
const cacheBust = `?v=${Date.now()}`;
await page.goto(`${base}${cacheBust}`, { waitUntil: 'networkidle2', timeout: 90000 });
await page.evaluate(() => document.querySelectorAll('.reveal').forEach((el) => el.classList.add('is-visible')));
await page.waitForFunction(
  () => {
    const selectors = [
      '#water-is-life-hidden-dangers-vr-campaign img[src*="water-is-life"]',
      '#google-spotlight-stories-group img[src*="image1"]',
      '#pearl .gallery-spotlight-film__hero img[src*="image3"]',
      '#on-ice .gallery-spotlight-film__hero img[src*="image4"]',
      '#mission-to-the-deep-exhibit img[src*="mba_color"]',
    ];
    return selectors.every((sel) => {
      const img = document.querySelector(sel);
      return img && img.complete && img.naturalWidth > 0;
    });
  },
  { timeout: 30000 },
);
await new Promise((r) => setTimeout(r, 300));
await page.screenshot({ path: `${outDir}/work-exp-intro-top.png`, fullPage: false });
await page.screenshot({ path: `${outDir}/work-exp-gallery-compact.png` });

if (await page.$('#water-is-life-hidden-dangers-vr-campaign')) {
  const startY = await page.evaluate(() => {
    const el = document.getElementById('water-is-life-hidden-dangers-vr-campaign');
    return el ? el.getBoundingClientRect().top + window.scrollY : 0;
  });
  const endY = await page.evaluate(() => {
    const el = document.getElementById('mission-to-the-deep-exhibit');
    const band = document.getElementById('google-spotlight-stories-group');
    if (el) return el.getBoundingClientRect().bottom + window.scrollY;
    if (band) return band.getBoundingClientRect().bottom + window.scrollY + 200;
    return 0;
  });
  await page.screenshot({
    path: `${outDir}/work-exp-gallery-pearl-group.png`,
    clip: { x: 0, y: Math.max(0, startY - 12), width: 1440, height: Math.min(1400, endY - startY + 24) },
  });
}

const videoTile = await page.$('[data-video-open]');
if (videoTile) {
  const box = await videoTile.boundingBox();
  if (box) {
    await page.screenshot({
      path: `${outDir}/work-exp-video-tile.png`,
      clip: { ...box, x: Math.max(0, box.x - 8), y: Math.max(0, box.y - 8), width: box.width + 16, height: box.height + 16 },
    });
  }
}

const openVideo = await page.$('[data-video-open]');
if (openVideo) {
  await openVideo.click();
  await page.waitForFunction(() => !document.querySelector('[data-video-modal]').hasAttribute('hidden'), {
    timeout: 5000,
  });
  await new Promise((r) => setTimeout(r, 500));
  await page.screenshot({ path: `${outDir}/work-exp-video-modal.png` });
}

await page.setViewport({ width: 390, height: 844 });
await page.goto(`${base}${cacheBust}`, { waitUntil: 'networkidle2', timeout: 90000 });
await page.evaluate(() => document.querySelectorAll('.reveal').forEach((el) => el.classList.add('is-visible')));
await new Promise((r) => setTimeout(r, 500));
await page.screenshot({ path: `${outDir}/work-exp-pearl-group-mobile.png`, fullPage: false });

await browser.close();
console.log('saved', outDir);
