import puppeteer from 'puppeteer-core';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const outDir = process.argv[2];
const baseUrl = process.argv[3];
const sha = process.argv[4] || 'local';

if (!outDir || !baseUrl) {
  console.error('usage: npx vite-node scripts/capture-home-flip-cadence.mjs <outDir> <homeUrl> [sha]');
  process.exit(1);
}

await mkdir(outDir, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: '/usr/local/bin/google-chrome',
  headless: true,
  args: ['--no-sandbox', '--disable-gpu', `--user-data-dir=/tmp/pptr-cadence-${process.pid}`],
});

const page = await browser.newPage();

async function shotFlip(filename) {
  const el = await page.$('[data-page-flip]');
  if (!el) throw new Error('missing data-page-flip');
  await el.screenshot({ path: path.join(outDir, filename) });
}

function analyzeIntervals(starts) {
  if (starts.length < 2) return { intervals: [], mean: null, variance: null, maxDev: null };
  const intervals = [];
  for (let i = 1; i < starts.length; i++) intervals.push(starts[i] - starts[i - 1]);
  const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  const variance = intervals.reduce((s, x) => s + (x - mean) ** 2, 0) / intervals.length;
  const maxDev = Math.max(...intervals.map((x) => Math.abs(x - mean)));
  return { intervals, mean, variance, maxDev, stddev: Math.sqrt(variance) };
}

await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
await page.goto(baseUrl, { waitUntil: 'networkidle2', timeout: 90000 });
await page.evaluate(() => document.querySelectorAll('.reveal').forEach((el) => el.classList.add('is-visible')));
await page.evaluate(() =>
  document.querySelector('[data-page-flip]')?.scrollIntoView({ block: 'center', behavior: 'instant' }),
);

const config = await page.evaluate(() => ({
  flipDurationMs: document.querySelector('[data-page-flip]')?.dataset?.flipDurationMs,
  flipIntervalMs: document.querySelector('[data-page-flip]')?.dataset?.flipIntervalMs,
}));

await new Promise((r) => setTimeout(r, 400));
await shotFlip(`home-flip-cadence-rest-${sha}.png`);

let starts = [];
for (let attempt = 0; attempt < 25; attempt++) {
  await new Promise((r) => setTimeout(r, 650));
  starts = await page.evaluate(() => document.querySelector('[data-page-flip]')?.getCadenceStarts?.() ?? []);
  if (starts.length >= 6) break;
}

let midShot = false;
for (let t = 0; t < 3200 && !midShot; t += 40) {
  await new Promise((r) => setTimeout(r, 40));
  const resting = await page.evaluate(
    () => document.querySelector('[data-flip-sheet]')?.dataset?.resting === 'true',
  );
  const under = await page.evaluate(() =>
    document.querySelector('[data-flip-under]')?.classList.contains('home-flip-under--active'),
  );
  if (!resting && under) {
    await shotFlip(`home-flip-cadence-midturn-${sha}.png`);
    midShot = true;
  }
}
if (!midShot) await shotFlip(`home-flip-cadence-midturn-${sha}.png`);

const cadence = analyzeIntervals(starts);
const tail = starts.length >= 6 ? analyzeIntervals(starts.slice(-6)) : cadence;

const reducedPage = await browser.newPage();
await reducedPage.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
await reducedPage.goto(baseUrl, { waitUntil: 'networkidle2' });
const reduced = await reducedPage.evaluate(() => ({
  prev: !document.querySelector('[data-flip-prev]')?.hidden,
  pauseHidden: document.querySelector('[data-flip-pause]')?.hidden,
}));
await reducedPage.close();

await browser.close();

const expectedInterval = parseInt(config.flipIntervalMs || '3000', 10);
const expectedDuration = parseInt(config.flipDurationMs || '300', 10);

const metrics = {
  baseUrl,
  deploySha: sha,
  capturedAt: new Date().toISOString(),
  config,
  expectedDurationMs: expectedDuration,
  expectedIntervalMs: expectedInterval,
  flipStartTimestamps: starts,
  cadenceAll: cadence,
  cadenceLastSix: tail,
  beforeStrategy: {
    flipDurationMs: '200–350 random',
    scheduling: 'setTimeout after flip complete + 3200ms dwell',
    modes: 'random multi-axis',
  },
  afterStrategy: {
    flipDurationMs: expectedDuration,
    scheduling: `setInterval ${expectedInterval}ms start-to-start`,
    modes: 'strict alternate right-y / left-y',
  },
  selfCheck: {
    minStarts: starts.length >= 5,
    intervalUniform: tail.maxDev != null && tail.maxDev <= 8,
    intervalNearTarget: tail.mean != null && Math.abs(tail.mean - expectedInterval) <= 12,
    fixedDuration: expectedDuration === 300,
    reducedOk: reduced.prev && reduced.pauseHidden,
    pass:
      starts.length >= 5 &&
      tail.maxDev != null &&
      tail.maxDev <= 8 &&
      tail.mean != null &&
      Math.abs(tail.mean - expectedInterval) <= 12 &&
      expectedDuration === 300,
  },
};

await writeFile(path.join(outDir, 'home-flip-cadence-metrics.json'), JSON.stringify(metrics, null, 2));
console.log(JSON.stringify(metrics, null, 2));
process.exit(metrics.selfCheck.pass ? 0 : 1);
