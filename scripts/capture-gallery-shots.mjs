import puppeteer from 'puppeteer-core';
import { mkdir } from 'node:fs/promises';
import { writeFileSync, readFileSync } from 'node:fs';

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

async function viewportShotBox(getBox) {
  await new Promise((r) => setTimeout(r, 400));
  const box = await page.evaluate(getBox);
  if (!box || box.height < 40) return null;
  return page.screenshot({
    encoding: 'base64',
    clip: {
      x: Math.max(0, box.x),
      y: Math.max(0, box.y),
      width: Math.min(box.width, 1440),
      height: box.height,
    },
  });
}

if (await page.$('#water-is-life-hidden-dangers-vr-campaign')) {
  await page.evaluate(() => {
    document.getElementById('water-is-life-hidden-dangers-vr-campaign')?.scrollIntoView({ block: 'start', behavior: 'instant' });
  });
  const waterB64 = await viewportShotBox(() => {
    const el = document.getElementById('water-is-life-hidden-dangers-vr-campaign');
    const r = el.getBoundingClientRect();
    return { x: 0, y: Math.max(0, r.y - 8), width: 1440, height: r.height + 16 };
  });

  await page.evaluate(() => {
    document.getElementById('on-ice')?.scrollIntoView({ block: 'end', behavior: 'instant' });
  });
  const bandB64 = await viewportShotBox(() => {
    const band = document.getElementById('google-spotlight-stories-group');
    const onIce = document.getElementById('on-ice');
    if (!band || !onIce) return null;
    const r1 = band.getBoundingClientRect();
    const r2 = onIce.getBoundingClientRect();
    const top = Math.min(r1.y, r2.y);
    return {
      x: 0,
      y: Math.max(0, top - 8),
      width: 1440,
      height: Math.min(2600, r2.bottom - top + 24),
    };
  });

  if (waterB64 && bandB64) {
    const stitched = await page.evaluate(
      async (a, b, gap) => {
        const load = (src) =>
          new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = src;
          });
        const imgA = await load(`data:image/png;base64,${a}`);
        const imgB = await load(`data:image/png;base64,${b}`);
        const w = Math.max(imgA.width, imgB.width);
        const h = imgA.height + gap + imgB.height;
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#050508';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(imgA, 0, 0);
        ctx.drawImage(imgB, 0, imgA.height + gap);
        return canvas.toDataURL('image/png').split(',')[1];
      },
      waterB64,
      bandB64,
      10,
    );
    writeFileSync(`${outDir}/work-exp-gallery-pearl-group.png`, Buffer.from(stitched, 'base64'));
  }
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
