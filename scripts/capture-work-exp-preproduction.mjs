import puppeteer from 'puppeteer-core';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { PREPRODUCTION_PANEL_ID } from '../src/utils/portfolioGallery.ts';

const PANEL_ID = PREPRODUCTION_PANEL_ID;
const outDir = process.argv[2];
const baseUrl =
  process.argv[3] ?? 'https://kagemushyabot.github.io/projects/work-experience/?v=' + Date.now();
const captureBefore = process.argv.includes('--before');

if (!outDir) {
  console.error('usage: npx vite-node scripts/capture-work-exp-preproduction.mjs <outDir> [baseUrl]');
  process.exit(1);
}

await mkdir(outDir, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: '/usr/local/bin/google-chrome',
  headless: true,
  args: ['--no-sandbox', '--disable-gpu', `--user-data-dir=/tmp/pptr-preprod-${process.pid}`],
});

const page = await browser.newPage();

async function gotoAndReveal(width, height) {
  await page.setViewport({ width, height });
  await page.goto(baseUrl, { waitUntil: 'networkidle2', timeout: 90000 });
  await page.evaluate(() => document.querySelectorAll('.reveal').forEach((el) => el.classList.add('is-visible')));
}

async function scrollPanel() {
  await page.evaluate((id) => {
    const y = document.getElementById(id)?.getBoundingClientRect().top ?? 0;
    window.scrollTo({ top: Math.max(0, y + window.scrollY - 28), behavior: 'instant' });
  }, PANEL_ID);
  await page.evaluate(async (id) => {
    const panel = document.getElementById(id);
    if (!panel) return;
    const imgs = [...panel.querySelectorAll('img')];
    await Promise.all(
      imgs.map(
        (img) =>
          new Promise((resolve) => {
            if (img.complete && img.naturalWidth) {
              img.decode?.().then(resolve).catch(resolve);
            } else {
              img.addEventListener('load', () => resolve(), { once: true });
              img.addEventListener('error', () => resolve(), { once: true });
              setTimeout(resolve, 2000);
            }
          }),
      ),
    );
  }, PANEL_ID);
  await new Promise((r) => setTimeout(r, 450));
}

async function measureLayout() {
  return page.evaluate((id) => {
    const panel = document.getElementById(id);
    if (!panel) return { error: 'panel_missing' };
    const title = panel.querySelector('.gallery-card-title')?.textContent?.trim();
    const grid = panel.querySelector('.gallery-card-media--preproduction-grid');
    const buttons = [...panel.querySelectorAll('.gallery-still-open')];
    const cells = buttons.map((btn) => {
      const img = btn.querySelector('img');
      const br = btn.getBoundingClientRect();
      const ir = img?.getBoundingClientRect();
      return {
        w: Math.round(br.width),
        h: Math.round(br.height),
        x: Math.round(br.x),
        y: Math.round(br.y),
        imgW: ir ? Math.round(ir.width) : 0,
        imgH: ir ? Math.round(ir.height) : 0,
        objectFit: img ? getComputedStyle(img).objectFit : null,
      };
    });
    const tops = [...new Set(cells.map((c) => c.y))].sort((a, b) => a - b);
    const lefts = [...new Set(cells.map((c) => c.x))].sort((a, b) => a - b);
    const overflowX = document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
    return {
      title,
      hasPreproductionGridClass: Boolean(grid),
      stillCount: cells.length,
      cells,
      uniqueTops: tops,
      uniqueLefts: lefts,
      grid2x2:
        cells.length === 4 &&
        tops.length === 2 &&
        lefts.length === 2 &&
        cells.every((c) => Math.abs(c.w - cells[0].w) <= 8),
      overflowX,
    };
  }, PANEL_ID);
}

async function screenshotPanel(filename) {
  const handle = await page.$(`#${PANEL_ID}`);
  const box = handle ? await handle.boundingBox() : null;
  if (!box || box.height < 80) {
    throw new Error(`Panel not visible for ${filename}`);
  }
  const title = await page.evaluate(
    (id) => document.getElementById(id)?.querySelector('.gallery-card-title')?.textContent?.trim(),
    PANEL_ID,
  );
  const top = Math.max(0, Math.floor(box.y - 10));
  const height = Math.min(900 - top, Math.ceil(box.height + 20));
  const viewW = (await page.viewport())?.width ?? 1440;
  await page.screenshot({
    path: path.join(outDir, filename),
    clip: { x: 0, y: top, width: viewW, height: Math.max(120, height) },
  });
  return { title, top, height, box };
}

await gotoAndReveal(1440, 900);
await scrollPanel();
const desktopLayout = await measureLayout();
const desktopShot = await screenshotPanel(
  captureBefore ? 'work-exp-preproduction-before-desktop.png' : 'work-exp-preproduction-2x2-desktop.png',
);

await gotoAndReveal(390, 844);
await scrollPanel();
const mobileLayout = await measureLayout();
const mobileShot = await screenshotPanel('work-exp-preproduction-mobile.png');

const metrics = {
  baseUrl,
  panelId: PANEL_ID,
  capturedAt: new Date().toISOString(),
  mode: captureBefore ? 'before' : 'after',
  desktop: { layout: desktopLayout, screenshot: desktopShot },
  mobile: { layout: mobileLayout, screenshot: mobileShot },
  selfCheck: {
    titleVisible: Boolean(desktopLayout.title?.toLowerCase().includes('preproduction')),
    fourStills: desktopLayout.stillCount === 4,
    grid2x2: desktopLayout.grid2x2,
    largerThanTiny: desktopLayout.cells?.every((c) => c.w >= 140 && c.h >= 100),
    objectFitContain: desktopLayout.cells?.every((c) => c.objectFit === 'contain'),
    mobileNoOverflow: !mobileLayout.overflowX,
    pass:
      desktopLayout.stillCount === 4 &&
      desktopLayout.grid2x2 &&
      desktopLayout.cells?.every((c) => c.w >= 140) &&
      !mobileLayout.overflowX,
  },
};

await writeFile(path.join(outDir, 'work-exp-preproduction-metrics.json'), JSON.stringify(metrics, null, 2));
await browser.close();

console.log(JSON.stringify({ pass: metrics.selfCheck.pass, selfCheck: metrics.selfCheck, metrics }, null, 2));
process.exit(metrics.selfCheck.pass ? 0 : 1);
