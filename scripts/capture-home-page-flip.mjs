import puppeteer from 'puppeteer-core';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const outDir = process.argv[2];
const baseUrl = process.argv[3];
const sha = process.argv[4] || 'local';

if (!outDir || !baseUrl) {
  console.error('usage: npx vite-node scripts/capture-home-page-flip.mjs <outDir> <homeUrl> [sha]');
  process.exit(1);
}

await mkdir(outDir, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: '/usr/local/bin/google-chrome',
  headless: true,
  args: ['--no-sandbox', '--disable-gpu', `--user-data-dir=/tmp/pptr-flip-${process.pid}`],
});

const page = await browser.newPage();

async function readFlipState() {
  return page.evaluate(() => {
    const root = document.querySelector('[data-home-flip]');
    const sheet = document.querySelector('[data-flip-sheet]');
    const title = document.querySelector('[data-flip-title]')?.textContent?.trim();
    const style = sheet ? getComputedStyle(sheet) : null;
    const m = style?.transform;
    let angle = 0;
    if (m && m !== 'none') {
      const nums = m.match(/matrix3d\(([^)]+)\)/)?.[1]?.split(',');
      if (nums && nums.length >= 16) {
        const a = parseFloat(nums[0]);
        const b = parseFloat(nums[1]);
        angle = Math.round((Math.atan2(b, a) * 180) / Math.PI);
      } else {
        const nums2 = m.match(/matrix\(([^)]+)\)/)?.[1]?.split(',');
        if (nums2?.length >= 4) {
          const a = parseFloat(nums2[0]);
          const b = parseFloat(nums2[1]);
          angle = Math.round((Math.atan2(b, a) * 180) / Math.PI);
        }
      }
    }
    const resting = sheet?.dataset?.resting === 'true';
    const frontImg = document.querySelector('[data-flip-img-front]');
    const frontBox = frontImg?.getBoundingClientRect();
    const visibleLargeImages = resting && frontBox && frontBox.width > 48 && frontBox.height > 48 ? 1 : 0;
    return {
      title,
      resting,
      currentProject: root?.dataset?.currentProject,
      flipAngleDataset: sheet?.dataset?.flipAngle,
      transformAngleDeg: angle,
      chaosChips: document.querySelectorAll('[data-chaos-chip]').length,
      flipFaces: document.querySelectorAll('[data-flip-face]').length,
      visibleLargeImages,
    };
  });
}

async function shotStage(filename) {
  const el = await page.$('[data-flip-stage]');
  if (!el) throw new Error('missing flip stage');
  await el.screenshot({ path: path.join(outDir, filename) });
}

async function runDesktop() {
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await page.goto(baseUrl, { waitUntil: 'networkidle2', timeout: 90000 });
  await page.evaluate(() => document.querySelectorAll('.reveal').forEach((el) => el.classList.add('is-visible')));
  await page.evaluate(() =>
    document.querySelector('[data-flip-stage]')?.scrollIntoView({ block: 'center', behavior: 'instant' }),
  );
  await page.evaluate(async () => {
    const img = document.querySelector('[data-flip-img-front]');
    if (!img) return;
    await new Promise((resolve) => {
      if (img.complete && img.naturalWidth) return img.decode?.().then(resolve).catch(resolve) ?? resolve();
      img.addEventListener('load', () => resolve(), { once: true });
      setTimeout(resolve, 2500);
    });
  });
  await new Promise((r) => setTimeout(r, 500));

  const restingA = await readFlipState();
  await shotStage(`home-flip-resting-${sha}.png`);

  await page.evaluate(() => {
    const root = document.querySelector('[data-home-flip]');
    if (root?.runFlipForTest) root.runFlipForTest(1);
  });

  const samples = [];
  let midCaptured = false;
  for (let t = 0; t < 900; t += 110) {
    await new Promise((r) => setTimeout(r, 110));
    const sample = { tMs: t + 110, ...(await readFlipState()) };
    samples.push(sample);
    if (!midCaptured && Math.abs(sample.transformAngleDeg) > 28) {
      await shotStage(`home-flip-midturn-${sha}.png`);
      midCaptured = true;
    }
  }
  if (!midCaptured) {
    await shotStage(`home-flip-midturn-${sha}.png`);
  }

  const midIdx = samples.reduce(
    (best, s, i) => (Math.abs(s.transformAngleDeg) > Math.abs(samples[best].transformAngleDeg) ? i : best),
    0,
  );
  const mid = samples[midIdx] ?? samples[Math.floor(samples.length / 2)];

  const titleChanged = restingA.title && samples.some((s) => s.title && s.title !== restingA.title);
  const transformDuringFlip = samples.some((s) => Math.abs(s.transformAngleDeg) > 12);

  return { restingA, samples, mid, titleChanged, transformDuringFlip };
}

async function runReducedAndMobile() {
  const reducedPage = await browser.newPage();
  await reducedPage.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await reducedPage.setViewport({ width: 1440, height: 900 });
  await reducedPage.goto(baseUrl, { waitUntil: 'networkidle2', timeout: 90000 });
  await reducedPage.evaluate(() => document.querySelectorAll('.reveal').forEach((el) => el.classList.add('is-visible')));
  const reduced = await reducedPage.evaluate(() => ({
    reducedClass: document.querySelector('[data-home-flip]')?.classList.contains('home-flip--reduced'),
    prevVisible: !document.querySelector('[data-flip-prev]')?.hidden,
    nextVisible: !document.querySelector('[data-flip-next]')?.hidden,
    pauseHidden: document.querySelector('[data-flip-pause]')?.hidden,
    chaosChips: document.querySelectorAll('[data-chaos-chip]').length,
  }));
  await reducedPage.close();

  const mobilePage = await browser.newPage();
  await mobilePage.setViewport({ width: 390, height: 844 });
  await mobilePage.goto(baseUrl, { waitUntil: 'networkidle2', timeout: 90000 });
  await mobilePage.evaluate(() => document.querySelectorAll('.reveal').forEach((el) => el.classList.add('is-visible')));
  const overflow = await mobilePage.evaluate(() => ({
    overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    chaosChips: document.querySelectorAll('[data-chaos-chip]').length,
  }));
  await mobilePage.close();

  return { reduced, overflow };
}

const desktop = await runDesktop();
const aux = await runReducedAndMobile();

const metrics = {
  baseUrl,
  deploySha: sha,
  capturedAt: new Date().toISOString(),
  desktop,
  reduced: aux.reduced,
  mobile: aux.overflow,
  selfCheck: {
    noChaosDom: desktop.restingA.chaosChips === 0 && aux.reduced.chaosChips === 0 && aux.overflow.chaosChips === 0,
    singleRestingImage: desktop.restingA.visibleLargeImages === 1,
    transformDuringFlip: desktop.transformDuringFlip,
    titleChanged: desktop.titleChanged,
    reducedPrevNext: aux.reduced.prevVisible && aux.reduced.nextVisible && aux.reduced.pauseHidden,
    mobileNoOverflow: !aux.overflow.overflowX,
    pass:
      desktop.restingA.chaosChips === 0 &&
      desktop.restingA.visibleLargeImages === 1 &&
      desktop.transformDuringFlip &&
      desktop.titleChanged &&
      aux.reduced.prevVisible &&
      aux.reduced.nextVisible &&
      !aux.overflow.overflowX,
  },
};

await writeFile(path.join(outDir, 'home-flip-metrics.json'), JSON.stringify(metrics, null, 2));
await browser.close();
console.log(JSON.stringify(metrics, null, 2));
process.exit(metrics.selfCheck.pass ? 0 : 1);
