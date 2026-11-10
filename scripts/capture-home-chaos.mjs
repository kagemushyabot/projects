import puppeteer from 'puppeteer-core';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { buildHomeChaosCollageItems } from '../src/utils/homeChaosCollage.ts';

const outDir = process.argv[2];
const baseUrl = process.argv[3];
const sha = process.argv[4] || 'local';

if (!outDir || !baseUrl) {
  console.error('usage: npx vite-node scripts/capture-home-chaos.mjs <outDir> <homeUrl> [sha]');
  process.exit(1);
}

await mkdir(outDir, { recursive: true });
const galleryItems = buildHomeChaosCollageItems();

const browser = await puppeteer.launch({
  executablePath: '/usr/local/bin/google-chrome',
  headless: true,
  args: ['--no-sandbox', '--disable-gpu', `--user-data-dir=/tmp/pptr-home-${process.pid}`],
});

function chipPositions(page) {
  return page.evaluate(() => {
    const cloud = document.querySelector('[data-chaos-cloud]');
    const chips = [...(cloud?.querySelectorAll('[data-chaos-chip]') ?? [])];
    return chips.map((chip) => {
      const r = chip.getBoundingClientRect();
      const label = chip.querySelector('.chaos-chip-label')?.textContent?.trim();
      return {
        label,
        x: Math.round(r.x),
        y: Math.round(r.y),
        w: Math.round(r.width),
        h: Math.round(r.height),
      };
    });
  });
}

async function shotCollage(page, filename) {
  const el = await page.$('[data-chaos-stage]');
  if (!el) throw new Error('missing chaos stage');
  await el.screenshot({ path: path.join(outDir, filename) });
}

async function runDesktop() {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(baseUrl, { waitUntil: 'networkidle2', timeout: 90000 });
  await page.evaluate(() => document.querySelectorAll('.reveal').forEach((el) => el.classList.add('is-visible')));
  await page.evaluate(() =>
    document.querySelector('[data-chaos-collage]')?.scrollIntoView({ block: 'center', behavior: 'instant' }),
  );
  await page.evaluate(async () => {
    const imgs = [...document.querySelectorAll('[data-chaos-chip] img')];
    await Promise.all(
      imgs.map(
        (img) =>
          new Promise((resolve) => {
            if (img.complete && img.naturalWidth) return img.decode?.().then(resolve).catch(resolve) ?? resolve();
            img.addEventListener('load', () => resolve(), { once: true });
            setTimeout(resolve, 2000);
          }),
      ),
    );
  });
  await new Promise((r) => setTimeout(r, 600));
  const sampleA = await chipPositions(page);
  await shotCollage(page, `home-chaos-frame-a-${sha}.png`);
  await new Promise((r) => setTimeout(r, 2200));
  const sampleB = await chipPositions(page);
  await shotCollage(page, `home-chaos-frame-b-${sha}.png`);
  const titles = await page.evaluate(() =>
    [...document.querySelectorAll('.chaos-chip-label')].map((el) => el.textContent?.trim()).filter(Boolean),
  );
  const delta =
    sampleA.length && sampleB.length
      ? sampleA.reduce((sum, a, i) => {
          const b = sampleB[i];
          if (!b) return sum;
          return sum + Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
        }, 0)
      : 0;
  await page.close();
  return { sampleA, sampleB, positionDeltaSum: delta, titles, motionDetected: delta > 40 };
}

async function runReduced() {
  const page = await browser.newPage();
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(baseUrl, { waitUntil: 'networkidle2', timeout: 90000 });
  await page.evaluate(() => document.querySelectorAll('.reveal').forEach((el) => el.classList.add('is-visible')));
  await page.evaluate(() =>
    document.querySelector('[data-chaos-collage]')?.scrollIntoView({ block: 'center', behavior: 'instant' }),
  );
  await new Promise((r) => setTimeout(r, 400));
  const staticClass = await page.evaluate(() =>
    document.querySelector('[data-chaos-cloud]')?.classList.contains('chaos-collage-cloud--static'),
  );
  const pauseHidden = await page.evaluate(() => document.querySelector('[data-chaos-pause]')?.hidden);
  await shotCollage(page, 'home-chaos-reduced-motion.png');
  await page.close();
  return { staticClass, pauseHidden };
}

async function runMobile() {
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844 });
  await page.goto(baseUrl, { waitUntil: 'networkidle2', timeout: 90000 });
  await page.evaluate(() => document.querySelectorAll('.reveal').forEach((el) => el.classList.add('is-visible')));
  const overflow = await page.evaluate(() => ({
    overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  }));
  await page.evaluate(() =>
    document.querySelector('[data-chaos-collage]')?.scrollIntoView({ block: 'center', behavior: 'instant' }),
  );
  await new Promise((r) => setTimeout(r, 400));
  await shotCollage(page, 'home-chaos-mobile.png');
  await page.close();
  return overflow;
}

const desktop = await runDesktop();
const reduced = await runReduced();
const mobile = await runMobile();

const metrics = {
  baseUrl,
  deploySha: sha,
  capturedAt: new Date().toISOString(),
  galleryBackedItemCount: galleryItems.length,
  titlesOnHome: desktop.titles?.length,
  desktop,
  reduced,
  mobile,
  selfCheck: {
    hasChaosStage: true,
    titlesVisible: (desktop.titles?.length ?? 0) >= 10,
    motionDelta: desktop.positionDeltaSum,
    motionPass: desktop.motionDetected,
    reducedStatic: reduced.staticClass === true,
    mobileNoOverflow: !mobile.overflowX,
    pass:
      (desktop.titles?.length ?? 0) >= 10 &&
      desktop.motionDetected &&
      reduced.staticClass === true &&
      !mobile.overflowX,
  },
};

await writeFile(path.join(outDir, 'home-chaos-motion-metrics.json'), JSON.stringify(metrics, null, 2));
await browser.close();

console.log(JSON.stringify(metrics, null, 2));
process.exit(metrics.selfCheck.pass ? 0 : 1);
