import puppeteer from 'puppeteer-core';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { execSync } from 'node:child_process';

const outDir = process.argv[2];
const afterUrl = process.argv[3];
const sha = process.argv[4] || 'local';
const beforeUrl = process.argv[5];

if (!outDir || !afterUrl) {
  console.error(
    'usage: npx vite-node scripts/capture-home-layout-bbox.mjs <outDir> <afterUrl> [sha] [beforeUrl]',
  );
  process.exit(1);
}

await mkdir(outDir, { recursive: true });

const SELECTORS = [
  { key: 'siteNav', sel: '.site-nav' },
  { key: 'homeHero', sel: '.home-hero' },
  { key: 'workXpHead', sel: '.work-xp-head' },
  { key: 'workXpLead', sel: '.work-xp-lead' },
  { key: 'slideshowPanel', sel: '[data-slideshow-stage], [data-flip-stage]' },
  { key: 'slideshowStack', sel: '.home-slideshow-stack, [data-flip-stack]' },
  { key: 'slideshowUi', sel: '.home-slideshow-ui, .home-flip-ui' },
  { key: 'slideshowCount', sel: '.home-slideshow-count, .home-flip-count' },
  { key: 'resumeTease', sel: '.resume-tease' },
];

function rectOf(el) {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return {
    x: Math.round(r.x),
    y: Math.round(r.y),
    width: Math.round(r.width),
    height: Math.round(r.height),
    right: Math.round(r.right),
    bottom: Math.round(r.bottom),
  };
}

async function measurePage(page, viewport) {
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
  await page.setViewport(viewport);
  await page.evaluate(() => document.querySelectorAll('.reveal').forEach((n) => n.classList.add('is-visible')));
  await page.evaluate(() =>
    window.scrollTo(0, 0),
  );
  await new Promise((r) => setTimeout(r, 200));
  const boxes = await page.evaluate((sels) => {
    function rectOf(el) {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return {
        x: Math.round(r.x),
        y: Math.round(r.y),
        width: Math.round(r.width),
        height: Math.round(r.height),
        right: Math.round(r.right),
        bottom: Math.round(r.bottom),
      };
    }
    const out = {};
    for (const { key, sel } of sels) {
      const el = document.querySelector(sel);
      out[key] = rectOf(el);
    }
    const stage = document.querySelector('[data-slideshow-stage], [data-flip-stage]');
    out.stageImageCount = stage?.querySelectorAll('img').length ?? 0;
    out.stageCaptionInPanel = !!(stage?.querySelector('.home-flip-project, [data-flip-title]'));
    return out;
  }, SELECTORS);
  return boxes;
}

async function captureFull(page, viewport, filename, url) {
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 120000 });
  const boxes = await measurePage(page, viewport);
  await page.screenshot({ path: path.join(outDir, filename), fullPage: true });
  return boxes;
}

const browser = await puppeteer.launch({
  executablePath: '/usr/local/bin/google-chrome',
  headless: true,
  args: ['--no-sandbox', '--disable-gpu', `--user-data-dir=/tmp/pptr-layout-${process.pid}`],
});

let beforeDesktop = null;
let beforeMobile = null;

if (beforeUrl) {
  const p = await browser.newPage();
  beforeDesktop = await captureFull(
    p,
    { width: 1440, height: 900, deviceScaleFactor: 1 },
    '_before-desktop-tmp.png',
    beforeUrl,
  );
  await p.goto(beforeUrl, { waitUntil: 'networkidle2', timeout: 120000 });
  beforeMobile = await measurePage(p, { width: 390, height: 844, deviceScaleFactor: 2 });
  await p.screenshot({ path: path.join(outDir, '_before-mobile-tmp.png'), fullPage: true });
  await p.close();
}

const afterPage = await browser.newPage();
const afterDesktop = await captureFull(
  afterPage,
  { width: 1440, height: 900, deviceScaleFactor: 1 },
  `home-full-layout-desktop-${sha}.png`,
  afterUrl,
);
await afterPage.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
await measurePage(afterPage, { width: 390, height: 844, deviceScaleFactor: 2 });
await afterPage.screenshot({
  path: path.join(outDir, `home-full-layout-mobile-${sha}.png`),
  fullPage: true,
});
const afterMobile = await measurePage(afterPage, { width: 390, height: 844, deviceScaleFactor: 2 });
await afterPage.close();
await browser.close();

function delta(a, b) {
  if (!a || !b) return null;
  return {
    dx: b.x - a.x,
    dy: b.y - a.y,
    dwidth: b.width - a.width,
    dheight: b.height - a.height,
  };
}

function compareSides(before, after) {
  const keys = SELECTORS.map((s) => s.key);
  const out = {};
  for (const k of keys) {
    out[k] = { before: before?.[k] ?? null, after: after?.[k] ?? null, delta: delta(before?.[k], after?.[k]) };
  }
  return out;
}

const desktopCompare = beforeDesktop ? compareSides(beforeDesktop, afterDesktop) : null;
const mobileCompare = beforeMobile ? compareSides(beforeMobile, afterMobile) : null;

function panelMatch(compare) {
  if (!compare?.slideshowPanel?.delta) return null;
  const d = compare.slideshowPanel.delta;
  return Math.abs(d.dx) <= 4 && Math.abs(d.dy) <= 28 && Math.abs(d.dwidth) <= 2 && Math.abs(d.dheight) <= 8;
}

const metrics = {
  afterUrl,
  beforeUrl: beforeUrl || null,
  deploySha: sha,
  capturedAt: new Date().toISOString(),
  baselineRef: 'daa5cd5 flip shell (if beforeUrl provided)',
  desktop: { before: beforeDesktop, after: afterDesktop, compare: desktopCompare },
  mobile: { before: beforeMobile, after: afterMobile, compare: mobileCompare },
  selfCheck: {
    oneImageInStage: afterDesktop.stageImageCount === 1,
    noTitleInStage: !afterDesktop.stageCaptionInPanel,
    panelDesktopRestored: panelMatch(desktopCompare) ?? 'no-before',
    panelMobileRestored: panelMatch(mobileCompare) ?? 'no-before',
    pass:
      afterDesktop.stageImageCount === 1 &&
      !afterDesktop.stageCaptionInPanel &&
      (panelMatch(desktopCompare) ?? true) &&
      (panelMatch(mobileCompare) ?? true),
  },
};

await writeFile(path.join(outDir, `home-layout-bbox-${sha}.json`), JSON.stringify(metrics, null, 2));
console.log(JSON.stringify(metrics, null, 2));
process.exit(metrics.selfCheck.pass ? 0 : 1);
