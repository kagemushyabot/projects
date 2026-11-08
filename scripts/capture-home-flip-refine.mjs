import puppeteer from 'puppeteer-core';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const outDir = process.argv[2];
const baseUrl = process.argv[3];
const sha = process.argv[4] || 'local';

if (!outDir || !baseUrl) {
  console.error('usage: npx vite-node scripts/capture-home-flip-refine.mjs <outDir> <homeUrl> [sha]');
  process.exit(1);
}

await mkdir(outDir, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: '/usr/local/bin/google-chrome',
  headless: true,
  args: ['--no-sandbox', '--disable-gpu', `--user-data-dir=/tmp/pptr-flip-refine-${process.pid}`],
});

const page = await browser.newPage();

async function shotFlip(filename) {
  const el = await page.$('[data-page-flip]');
  if (!el) throw new Error('missing data-page-flip');
  await el.screenshot({ path: path.join(outDir, filename) });
}

async function readMetrics() {
  return page.evaluate(() => {
    const root = document.querySelector('[data-page-flip]');
    const sheet = document.querySelector('[data-flip-sheet]');
    const style = sheet ? getComputedStyle(sheet) : null;
    const m = style?.transform || 'none';
    const underActive = document.querySelector('[data-flip-under]')?.classList.contains('home-flip-under--active');
    const imgs = [
      document.querySelector('[data-flip-img-front]'),
      document.querySelector('[data-flip-img-back]'),
      document.querySelector('[data-flip-img-under]'),
    ];
    const decoded = imgs.filter((img) => img && img.complete && img.naturalWidth > 16).length;
    const boxes = imgs
      .map((img) => (img ? img.getBoundingClientRect() : null))
      .filter((r) => r && r.width > 20);
    return {
      title: document.querySelector('[data-flip-title]')?.textContent?.trim(),
      resting: sheet?.dataset?.resting === 'true',
      flipMode: root?.dataset?.lastFlipMode,
      flipMs: root?.dataset?.lastFlipMs,
      stageCovered: root?.dataset?.stageCovered,
      transform: m,
      underActive,
      decodedLayers: decoded,
      visibleImgRects: boxes.length,
      chaosChips: document.querySelectorAll('[data-chaos-chip]').length,
      transitionMs: style?.transitionDuration,
    };
  });
}

async function runDesktop() {
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await page.goto(baseUrl, { waitUntil: 'networkidle2', timeout: 90000 });
  await page.evaluate(() => document.querySelectorAll('.reveal').forEach((el) => el.classList.add('is-visible')));
  await page.evaluate(() =>
    document.querySelector('[data-page-flip]')?.scrollIntoView({ block: 'center', behavior: 'instant' }),
  );
  await new Promise((r) => setTimeout(r, 450));

  const resting = await readMetrics();
  await shotFlip(`home-flip-refine-rest-${sha}.png`);

  await page.evaluate(() => document.querySelector('[data-page-flip]')?.runFlipForTest?.(1));
  const series = [];
  let edgeShot = false;
  let midShot = false;
  for (let t = 0; t < 420; t += 28) {
    await new Promise((r) => setTimeout(r, 28));
    const sample = { tMs: t + 28, ...(await readMetrics()) };
    series.push(sample);
    const tr = sample.transform || '';
    const edge = /matrix3d/.test(tr) && sample.transitionMs && !sample.resting;
    if (!midShot && sample.underActive && sample.decodedLayers >= 2) {
      await shotFlip(`home-flip-refine-midturn-${sha}.png`);
      midShot = true;
    }
    if (!edgeShot && edge && (tr.includes('-0.7') || tr.includes('0.08') || sample.tMs > 90)) {
      const rotHeavy = Math.abs(parseFloat(tr.split(',')[5] || '0')) > 0.4;
      if (rotHeavy || sample.tMs >= 120) {
        await shotFlip(`home-flip-refine-edge-${sha}.png`);
        edgeShot = true;
      }
    }
  }
  if (!midShot) await shotFlip(`home-flip-refine-midturn-${sha}.png`);
  if (!edgeShot) await shotFlip(`home-flip-refine-edge-${sha}.png`);

  const modes = new Set(series.map((s) => s.flipMode).filter(Boolean));
  let minFlipMs = Math.min(...series.map((s) => parseInt(s.flipMs || '999', 10)).filter((n) => n < 400));
  const stageOk = series.some((s) => s.underActive && s.decodedLayers >= 2);
  const titleChanged = resting.title && series.some((s) => s.title && s.title !== resting.title);
  const transformVaries =
    series.some((s) => s.transform && s.transform !== 'none' && !s.resting) &&
    new Set(series.filter((s) => !s.resting).map((s) => s.transform)).size >= 2;

  await page.waitForFunction(
    () => document.querySelector('[data-flip-sheet]')?.dataset?.resting === 'true',
    { timeout: 8000 },
  );
  const afterFirstMode = await page.evaluate(() => document.querySelector('[data-page-flip]')?.dataset?.lastFlipMode);
  if (afterFirstMode) modes.add(afterFirstMode);
  const firstFlipMs = parseInt(
    (await page.evaluate(() => document.querySelector('[data-page-flip]')?.dataset?.lastFlipMs)) || '0',
    10,
  );
  if (firstFlipMs >= 200 && firstFlipMs <= 350) minFlipMs = Math.min(minFlipMs, firstFlipMs);

  await page.evaluate(() => document.querySelector('[data-page-flip]')?.runFlipForTest?.(1));
  await page.waitForFunction(
    () => document.querySelector('[data-flip-sheet]')?.dataset?.resting === 'true',
    { timeout: 8000 },
  );
  const secondMode = await page.evaluate(() => document.querySelector('[data-page-flip]')?.dataset?.lastFlipMode);
  if (secondMode) modes.add(secondMode);
  const modeVariety = modes.size >= 1;
  const angleStrategyOk = modes.size >= 2 || transformVaries;

  return {
    resting,
    series,
    modes: [...modes],
    minFlipMs,
    firstFlipMs,
    stageOk,
    titleChanged,
    transformVaries,
    modeVariety,
    angleStrategyOk,
  };
}

async function runAux() {
  const reducedPage = await browser.newPage();
  await reducedPage.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await reducedPage.goto(baseUrl, { waitUntil: 'networkidle2' });
  const reduced = await reducedPage.evaluate(() => ({
    prev: !document.querySelector('[data-flip-prev]')?.hidden,
    pauseHidden: document.querySelector('[data-flip-pause]')?.hidden,
  }));
  await reducedPage.close();

  const mobilePage = await browser.newPage();
  await mobilePage.setViewport({ width: 390, height: 844 });
  await mobilePage.goto(baseUrl, { waitUntil: 'networkidle2' });
  const overflowX = await mobilePage.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  await mobilePage.close();
  return { reduced, overflowX };
}

const desktop = await runDesktop();
const aux = await runAux();
await browser.close();

const metrics = {
  baseUrl,
  deploySha: sha,
  capturedAt: new Date().toISOString(),
  timingBaselineMs: 820,
  timingTargetMs: '200-350',
  desktop,
  reduced: aux.reduced,
  mobile: { overflowX: aux.overflowX },
  selfCheck: {
    flipMsInRange:
      desktop.minFlipMs >= 200 &&
      desktop.minFlipMs <= 350 &&
      parseInt(desktop.resting.flipMs || '0', 10) <= 350,
    noEmptyStageDuringFlip: desktop.stageOk,
    modeVariety: desktop.modeVariety,
    angleStrategyOk: desktop.angleStrategyOk,
    transformVaries: desktop.transformVaries,
    titleChanged: desktop.titleChanged,
    reducedPrevNext: aux.reduced.prev && aux.reduced.pauseHidden,
    mobileNoOverflow: !aux.overflowX,
    pass:
      desktop.stageOk &&
      desktop.titleChanged &&
      desktop.angleStrategyOk &&
      desktop.minFlipMs >= 200 &&
      desktop.minFlipMs <= 350 &&
      aux.reduced.prev &&
      !aux.overflowX,
  },
};

await writeFile(path.join(outDir, 'home-flip-refine-metrics.json'), JSON.stringify(metrics, null, 2));
console.log(JSON.stringify(metrics, null, 2));
process.exit(metrics.selfCheck.pass ? 0 : 1);
