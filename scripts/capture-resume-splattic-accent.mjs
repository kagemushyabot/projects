import puppeteer from 'puppeteer-core';
import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const outDir = process.argv[2];
const baseUrl = process.argv[3];
const sha = process.argv[4] || 'local';

if (!outDir || !baseUrl) {
  console.error(
    'usage: npx vite-node scripts/capture-resume-splattic-accent.mjs <outDir> <resumeUrl> [sha]',
  );
  process.exit(1);
}

await mkdir(outDir, { recursive: true });

const PHRASE = 'Splattic development';

const browser = await puppeteer.launch({
  executablePath: '/usr/local/bin/google-chrome',
  headless: true,
  args: ['--no-sandbox', '--disable-gpu', `--user-data-dir=/tmp/pptr-splattic-${process.pid}`],
});

async function measurePhrase(page) {
  return page.evaluate((phrase) => {
    const el = [...document.querySelectorAll('.resume-accent-name')].find((node) =>
      node.textContent?.trim().startsWith(phrase),
    );
    if (!el) return { found: false };
    const cs = getComputedStyle(el);
    const parentLi = el.closest('li');
    return {
      found: true,
      text: el.textContent?.trim(),
      className: el.className,
      fontSize: cs.fontSize,
      fontWeight: cs.fontWeight,
      color: cs.color,
      liStartsWithAccentOnly:
        !!parentLi &&
        parentLi.querySelector('.resume-accent-name') === el &&
        parentLi.textContent?.trim().startsWith(phrase),
    };
  }, PHRASE);
}

async function cropShot(page, suffix) {
  const box = await page.evaluate((phrase) => {
    const el = [...document.querySelectorAll('.resume-accent-name')].find((node) =>
      node.textContent?.trim().startsWith(phrase),
    );
    if (!el) return null;
    const li = el.closest('li') || el;
    const r = li.getBoundingClientRect();
    return {
      x: Math.max(0, Math.round(r.x - 12)),
      y: Math.max(0, Math.round(r.y - 8)),
      width: Math.min(window.innerWidth, Math.round(r.width + 24)),
      height: Math.min(900, Math.round(r.height + 16)),
    };
  }, PHRASE);

  if (!box) throw new Error(`missing ${PHRASE} accent for ${suffix}`);
  const file = path.join(outDir, `resume-splattic-dev-crop-${suffix}-${sha}.png`);
  await page.screenshot({ path: file, clip: box });
  return file;
}

let desktop = { found: false };

for (const { w, h, name } of [
  { w: 1440, h: 900, name: 'desktop' },
  { w: 390, h: 844, name: 'mobile' },
]) {
  const page = await browser.newPage();
  await page.setViewport({
    width: w,
    height: h,
    deviceScaleFactor: name === 'mobile' ? 2 : 1,
  });
  await page.goto(baseUrl, { waitUntil: 'networkidle2', timeout: 90000 });
  await page.waitForSelector('.resume-accent-name', { timeout: 30000 });
  await page.evaluate(() => {
    const job = [...document.querySelectorAll('.resume-job h3')].find((h) =>
      h.textContent?.includes('Tactic Studio'),
    );
    job?.closest('.resume-job')?.scrollIntoView({ block: 'center', behavior: 'instant' });
  });
  await page.waitForFunction(
    () =>
      [...document.querySelectorAll('.resume-accent-name')].some((node) =>
        node.textContent?.trim().startsWith('Splattic development'),
      ),
    { timeout: 15000 },
  );
  await new Promise((r) => setTimeout(r, 400));
  if (name === 'desktop') desktop = await measurePhrase(page);
  const outPath = await cropShot(page, name);
  if (name === 'desktop') {
    await copyFile(outPath, path.join(outDir, `resume-splattic-dev-crop-${sha}.png`));
  }
  await page.close();
}

await browser.close();
const metrics = {
  baseUrl,
  sha,
  capturedAt: new Date().toISOString(),
  phrase: PHRASE,
  computed: desktop,
  selfCheck: {
    found: desktop.found === true,
    fontSize18px: desktop.fontSize === '18px',
    fontWeight600: desktop.fontWeight === '600' || desktop.fontWeight === 600,
    colorRgb: desktop.color === 'rgb(212, 180, 131)',
    accentScopeOk: desktop.liStartsWithAccentOnly === true,
    pass:
      desktop.found &&
      desktop.fontSize === '18px' &&
      (desktop.fontWeight === '600' || desktop.fontWeight === 600) &&
      desktop.color === 'rgb(212, 180, 131)' &&
      desktop.liStartsWithAccentOnly,
  },
};

await writeFile(path.join(outDir, `resume-splattic-accent-metrics-${sha}.json`), JSON.stringify(metrics, null, 2));
console.log(JSON.stringify(metrics, null, 2));
process.exit(metrics.selfCheck.pass ? 0 : 1);
