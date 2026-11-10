import puppeteer from 'puppeteer-core';
import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  auditHomeSlideshowAllStills,
  buildHomeStillSlideshowItems,
} from '../src/utils/homeChaosCollage.ts';

const outDir = process.argv[2];
const baseUrl = process.argv[3];
const sha = process.argv[4] || 'local';

if (!outDir || !baseUrl) {
  console.error('usage: npx vite-node scripts/capture-home-slideshow.mjs <outDir> <homeUrl> [sha]');
  process.exit(1);
}

await mkdir(outDir, { recursive: true });

const audit = auditHomeSlideshowAllStills();
const stillItemCount = buildHomeStillSlideshowItems().length;

function analyzeIntervals(starts) {
  if (starts.length < 2) return { intervals: [], mean: null, variance: null, maxDev: null };
  const intervals = [];
  for (let i = 1; i < starts.length; i++) intervals.push(starts[i] - starts[i - 1]);
  const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  const variance = intervals.reduce((s, x) => s + (x - mean) ** 2, 0) / intervals.length;
  const maxDev = Math.max(...intervals.map((x) => Math.abs(x - mean)));
  return { intervals, mean, variance, maxDev, stddev: Math.sqrt(variance) };
}

const browser = await puppeteer.launch({
  executablePath: '/usr/local/bin/google-chrome',
  headless: true,
  args: ['--no-sandbox', '--disable-gpu', `--user-data-dir=/tmp/pptr-slide-${process.pid}`],
});

async function captureViewport(page, filename) {
  const stage = await page.$('[data-slideshow-stage]');
  if (!stage) throw new Error('missing slideshow stage');
  const probe = await stage.evaluate((node) => {
    const imgs = node.querySelectorAll('img');
    const text = (node.textContent || '').trim();
    return {
      imgCount: imgs.length,
      hasCaption: text.length > 0,
      imgSrc: imgs[0]?.getAttribute('src') || null,
      hasFlipMarkup: !!node.querySelector('[data-flip-sheet], [data-flip-under], .home-flip-project'),
    };
  });
  await stage.screenshot({ path: path.join(outDir, filename) });
  return probe;
}

async function runSession(viewport, suffix) {
  const page = await browser.newPage();
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
  await page.setViewport(viewport);
  await page.goto(baseUrl, { waitUntil: 'networkidle2', timeout: 90000 });
  await page.evaluate(() => document.querySelectorAll('.reveal').forEach((el) => el.classList.add('is-visible')));
  await page.waitForSelector('[data-home-slideshow]');
  await page.waitForFunction(
    () => {
      const root = document.querySelector('[data-home-slideshow]');
      return root && (root.dataset.slideshowIntervalMs === '1000' || root.classList.contains('home-slideshow--reduced'));
    },
    { timeout: 25000 },
  );
  await page.evaluate(() =>
    document.querySelector('[data-slideshow-stage]')?.scrollIntoView({ block: 'center', behavior: 'instant' }),
  );

  const t0 = await captureViewport(page, `home-slideshow-one-image-${suffix}-${sha}-t0.png`);
  const src0 = t0.imgSrc;
  await new Promise((r) => setTimeout(r, 1100));
  const t1 = await captureViewport(page, `home-slideshow-one-image-${suffix}-${sha}-t1.png`);
  await new Promise((r) => setTimeout(r, 5200));

  let ticks = [];
  for (let i = 0; i < 12; i++) {
    await new Promise((r) => setTimeout(r, 250));
    ticks = await page.evaluate(() => document.querySelector('[data-home-slideshow]')?.getSlideshowTickStarts?.() ?? []);
    if (ticks.length >= 6) break;
  }

  const cadence = analyzeIntervals(ticks.slice(-6));
  const tail = analyzeIntervals(ticks.slice(-6));

  await page.close();
  return { t0, t1, src0, src1: t1.imgSrc, ticks, cadence, tail };
}

const desktop = await runSession({ width: 1440, height: 900, deviceScaleFactor: 1 }, 'desktop');
const mobile = await runSession({ width: 390, height: 844, deviceScaleFactor: 2 }, 'mobile');

await browser.close();

const expectedInterval = 1000;

const metrics = {
  baseUrl,
  deploySha: sha,
  capturedAt: new Date().toISOString(),
  stillItemCount,
  galleryStillInventoryCount: audit.galleryStillInventoryCount,
  galleryStillInventoryUniqueCount: audit.galleryStillInventoryUniqueUrls.length,
  galleryStillInventory: audit.galleryStillInventory,
  includedStills: audit.includedStills,
  missingStillUrls: audit.missingStillUrls,
  extraStillUrls: audit.extraStillUrls,
  excludedVideoOnlyProjects: audit.excludedVideoOnlyProjects,
  excludedVideoThumbs: audit.excludedVideoOnlyProjects.map((row) => ({
    projectId: row.projectId,
    title: row.title,
    posterUrls: row.youtubeIds.map((id) => `https://img.youtube.com/vi/${id}/mqdefault.jpg`),
  })),
  intervalMs: expectedInterval,
  desktop,
  mobile,
  cadenceLastSix: desktop.tail,
  selfCheck: {
    oneImageDesktop: desktop.t0.imgCount === 1 && desktop.t1.imgCount === 1,
    oneImageMobile: mobile.t0.imgCount === 1 && mobile.t1.imgCount === 1,
    noStageCaption: !desktop.t0.hasCaption && !desktop.t1.hasCaption,
    noFlipMarkup: !desktop.t0.hasFlipMarkup && !mobile.t0.hasFlipMarkup,
    minTicks: desktop.ticks.length >= 5,
    intervalNear1s: desktop.tail.mean != null && Math.abs(desktop.tail.mean - expectedInterval) <= 25,
    intervalUniform: desktop.tail.maxDev != null && desktop.tail.maxDev <= 30,
    noYoutubeInSlideshowSources: audit.includedStills.every((s) => !s.src.includes('img.youtube.com')),
    zeroMissingStills: audit.zeroMissingStills,
    zeroVideoPosters: audit.zeroVideoPosters,
    inventoryMatch: audit.inventoryMatch,
    itemCountOk: stillItemCount === audit.galleryStillInventoryUniqueUrls.length,
    pass:
      audit.inventoryMatch &&
      audit.zeroVideoPosters &&
      stillItemCount === audit.galleryStillInventoryUniqueUrls.length &&
      desktop.t0.imgCount === 1 &&
      desktop.t1.imgCount === 1 &&
      mobile.t0.imgCount === 1 &&
      !desktop.t0.hasCaption &&
      !desktop.t0.hasFlipMarkup &&
      desktop.ticks.length >= 5 &&
      desktop.tail.mean != null &&
      Math.abs(desktop.tail.mean - expectedInterval) <= 25 &&
      audit.includedStills.every((s) => !s.src.includes('img.youtube.com')),
  },
};

await writeFile(path.join(outDir, `home-slideshow-metrics-${sha}.json`), JSON.stringify(metrics, null, 2));
// Canonical single-image proof (desktop t0) for deliverable name
await copyFile(
  path.join(outDir, `home-slideshow-one-image-desktop-${sha}-t0.png`),
  path.join(outDir, `home-slideshow-one-image-${sha}.png`),
);
console.log(JSON.stringify(metrics, null, 2));
process.exit(metrics.selfCheck.pass ? 0 : 1);
