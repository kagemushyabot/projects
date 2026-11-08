import puppeteer from 'puppeteer-core';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const outDir = process.argv[2];
if (!outDir) {
  console.error('usage: node scripts/verify-evil-eye-layout.mjs <outDir> [baseUrl]');
  process.exit(1);
}
const base =
  process.argv[3] ?? 'http://127.0.0.1:4321/projects/work-experience/?v=' + Date.now();

await mkdir(outDir, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: '/usr/local/bin/google-chrome',
  headless: true,
  args: [
    '--no-sandbox',
    '--disable-gpu',
    `--user-data-dir=/tmp/pptr-evil-eye-${process.pid}`,
  ],
});

const page = await browser.newPage();
await page.setRequestInterception(true);
page.on('request', (req) => {
  const url = req.url();
  if (
    req.isNavigationRequest() ||
    url.startsWith('http://127.0.0.1') ||
    url.startsWith('data:')
  ) {
    req.continue();
    return;
  }
  if (['stylesheet', 'script', 'image', 'font'].includes(req.resourceType())) {
    req.continue();
    return;
  }
  req.continue();
});
await page.setViewport({ width: 1440, height: 900 });
await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 45000 });
await page.evaluate(() => {
  document.querySelectorAll('.reveal').forEach((el) => el.classList.add('is-visible'));
  document.querySelector('#water-is-life-hidden-dangers-vr-campaign')?.scrollIntoView({ block: 'center' });
});
await new Promise((r) => setTimeout(r, 800));
await page.evaluate(() => {
  document.querySelector('#evil-eye-pictures-san-francisco')?.scrollIntoView({ block: 'center' });
});
await new Promise((r) => setTimeout(r, 400));
await page.waitForFunction(
  () => {
    const water = document.querySelector('#water-is-life-hidden-dangers-vr-campaign .gallery-image img');
    const pearl = document.querySelector(
      '#evil-eye-pictures-san-francisco .gallery-image--evil-eye-hero img',
    );
    return Boolean(water?.naturalWidth && water.naturalWidth > 200 && pearl?.naturalWidth && pearl.naturalWidth > 80);
  },
  { timeout: 20000 },
);

const metrics = await page.evaluate(() => {
  const rect = (el) => {
    const r = el?.getBoundingClientRect();
    return r ? { w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.x), y: Math.round(r.y) } : null;
  };
  const waterImg = document.querySelector('#water-is-life-hidden-dangers-vr-campaign .gallery-image img');
  const evilPanel = document.querySelector('#evil-eye-pictures-san-francisco');
  const evilStills = [...(evilPanel?.querySelectorAll('.gallery-image--evil-eye-hero img') ?? [])];
  const evilVideos = [...(evilPanel?.querySelectorAll('.gallery-evil-eye-slot--video img') ?? [])];
  const spotlightLogo = evilPanel?.querySelector('.gallery-evil-eye-slot:first-child img');
  const order = [...(evilPanel?.querySelectorAll('.gallery-evil-eye-slot') ?? [])].map((slot, i) => {
    const isVid = slot.classList.contains('gallery-evil-eye-slot--video');
    const img = slot.querySelector('img');
    return { i, kind: isVid ? 'video' : 'image', alt: img?.getAttribute('alt') || '', ...rect(img) };
  });
  const docWidth = document.documentElement.clientWidth;
  const overflowX = document.documentElement.scrollWidth > docWidth + 1;
  return {
    waterStill: rect(waterImg),
    waterNatural: waterImg ? { w: waterImg.naturalWidth, h: waterImg.naturalHeight } : null,
    evilPanel: rect(evilPanel),
    spotlightLogo: rect(spotlightLogo),
    pearlStill: rect(evilStills[0]),
    onIceStill: rect(evilStills[1]),
    pearlThumb: rect(evilVideos[0]),
    onIceThumb: rect(evilVideos[1]),
    evilEyeOrder: order,
    hasSpotlightGroup: Boolean(document.querySelector('#google-spotlight-stories-group')),
    hasImageModal: Boolean(document.querySelector('[data-image-modal]')),
    overflowX,
    docWidth,
  };
});

await writeFile(path.join(outDir, 'work-exp-layout-metrics.json'), JSON.stringify(metrics, null, 2));

await page.screenshot({
  path: path.join(outDir, 'work-exp-water-ref-dims.png'),
  clip: await page
    .evaluate(() => {
      const water = document.querySelector('#water-is-life-hidden-dangers-vr-campaign');
      const evil = document.querySelector('#evil-eye-pictures-san-francisco');
      if (!water) return null;
      const r1 = water.getBoundingClientRect();
      const r2 = evil?.getBoundingClientRect();
      const top = Math.min(r1.top, r2?.top ?? r1.top) - 12;
      const bottom = Math.max(r1.bottom, r2?.bottom ?? r1.bottom) + 12;
      return {
        x: 0,
        y: Math.max(0, top),
        width: 1440,
        height: Math.min(900, bottom - Math.max(0, top)),
      };
    })
    .then((c) => c ?? { x: 0, y: 0, width: 1440, height: 500 }),
});

await page.setViewport({ width: 1440, height: 900 });
await page.evaluate(() => document.querySelector('#evil-eye-pictures-san-francisco')?.scrollIntoView({ block: 'start' }));
await new Promise((r) => setTimeout(r, 300));
await page.screenshot({
  path: path.join(outDir, 'work-exp-evil-eye-desktop.png'),
  fullPage: false,
});

await page.setViewport({ width: 390, height: 844 });
await page.evaluate(() =>
  document.querySelector('#evil-eye-pictures-san-francisco')?.scrollIntoView({ block: 'start' }),
);
await new Promise((r) => setTimeout(r, 400));
const mobile = await page.evaluate(() => ({
  overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  scrollWidth: document.documentElement.scrollWidth,
  clientWidth: document.documentElement.clientWidth,
}));
await writeFile(path.join(outDir, 'work-exp-mobile-metrics.json'), JSON.stringify(mobile, null, 2));
await page.screenshot({ path: path.join(outDir, 'work-exp-evil-eye-mobile.png'), fullPage: false });

await browser.close();
console.log(JSON.stringify({ metrics, mobile }, null, 2));
