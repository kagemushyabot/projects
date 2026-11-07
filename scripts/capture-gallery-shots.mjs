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

await page.evaluate(() => {
  document.getElementById('water-is-life-hidden-dangers-vr-campaign')?.scrollIntoView({ block: 'start', behavior: 'instant' });
});
await new Promise((r) => setTimeout(r, 500));
await page.waitForFunction(
  () => {
    const sample = (sel) => {
      const img = document.querySelector(sel);
      if (!img || !img.complete || img.naturalWidth === 0) return false;
      const r = img.getBoundingClientRect();
      if (r.width < 80 || r.height < 80) return false;
      const c = document.createElement('canvas');
      c.width = c.height = 8;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0, 8, 8);
      const d = ctx.getImageData(4, 4, 1, 1).data;
      const lum = 0.2126 * d[0] + 0.7152 * d[1] + 0.0722 * d[2];
      return lum > 18;
    };
    return (
      sample('#water-is-life-hidden-dangers-vr-campaign .gallery-feature-hero img') &&
      sample('#pearl .gallery-spotlight-film__hero img') &&
      sample('#on-ice .gallery-spotlight-film__hero img')
    );
  },
  { timeout: 20000 },
);
await new Promise((r) => setTimeout(r, 250));
await page.screenshot({ path: `${outDir}/work-exp-intro-top.png`, fullPage: false });
await page.screenshot({ path: `${outDir}/work-exp-gallery-compact.png` });

if (await page.$('#water-is-life-hidden-dangers-vr-campaign')) {
  const clip = await page.evaluate(() => {
    const water = document.getElementById('water-is-life-hidden-dangers-vr-campaign');
    const onIce = document.getElementById('on-ice');
    const onIceHero = onIce?.querySelector('.gallery-spotlight-film__hero');
    const pad = 12;
    const docTop = (el) => {
      if (!el) return 0;
      const r = el.getBoundingClientRect();
      return r.top + window.scrollY;
    };
    const docBottom = (el) => {
      if (!el) return 0;
      const r = el.getBoundingClientRect();
      return r.bottom + window.scrollY;
    };
    const start = docTop(water);
    const endBottom = docBottom(onIceHero) || docBottom(onIce) || start + 900;
    document.getElementById('on-ice')?.scrollIntoView({ block: 'end', behavior: 'instant' });
    return {
      startY: Math.max(0, start - pad),
      endBottom,
      pad,
    };
  });
  await new Promise((r) => setTimeout(r, 450));
  const clipRect = {
    x: 0,
    y: clip.startY,
    width: 1440,
    height: Math.min(2400, Math.max(400, clip.endBottom - clip.startY + clip.pad * 2)),
  };
  await page.screenshot({
    path: `${outDir}/work-exp-gallery-pearl-group.png`,
    clip: clipRect,
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

const pearlStill = await page.$('#pearl [data-film-hero][data-image-open]');
if (pearlStill) {
  await pearlStill.click();
  const imageModal = await page.waitForSelector('[data-image-modal]:not([hidden])', { timeout: 8000 });
  if (imageModal) {
    await new Promise((r) => setTimeout(r, 400));
    await page.screenshot({ path: `${outDir}/work-exp-image-lightbox.png` });
    await page.click('[data-image-modal] [data-image-close]');
    await page.waitForSelector('[data-image-modal][hidden]', { timeout: 5000 }).catch(() => {});
    await new Promise((r) => setTimeout(r, 200));
  }
}

const openVideo = await page.$('[data-video-open]');
if (openVideo) {
  await openVideo.click();
  await page
    .waitForFunction(() => !document.querySelector('[data-video-modal]').hasAttribute('hidden'), {
      timeout: 8000,
    })
    .catch(() => {});
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
