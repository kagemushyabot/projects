import puppeteer from 'puppeteer-core';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const outDir = process.argv[2];
const baseUrl = process.argv[3];
const sha = process.argv[4] || 'local';

if (!outDir || !baseUrl) {
  console.error(
    'usage: npx vite-node scripts/capture-resume-pearl-onice.mjs <outDir> <resumeUrl> [sha]',
  );
  process.exit(1);
}

await mkdir(outDir, { recursive: true });

function relativeLuminance(rgb) {
  const [r, g, b] = rgb.map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(fg, bg) {
  const L1 = relativeLuminance(fg);
  const L2 = relativeLuminance(bg);
  const lighter = Math.max(L1, L2);
  const darker = Math.min(L1, L2);
  return (lighter + 0.05) / (darker + 0.05);
}

function parseRgb(str) {
  const m = str.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!m) return null;
  return [parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10)];
}

const browser = await puppeteer.launch({
  executablePath: '/usr/local/bin/google-chrome',
  headless: true,
  args: ['--no-sandbox', '--disable-gpu', `--user-data-dir=/tmp/pptr-pearl-${process.pid}`],
});

async function measureTitles(page) {
  return page.evaluate(() => {
    const titles = [...document.querySelectorAll('.resume-section li > strong')].filter((el) => {
      const t = el.textContent?.trim();
      return t === 'Pearl' || t === 'On Ice';
    });
    return titles.map((el) => {
      const cs = getComputedStyle(el);
      const liCs = getComputedStyle(el.parentElement);
      const rect = el.getBoundingClientRect();
      return {
        text: el.textContent?.trim(),
        fontSizePx: parseFloat(cs.fontSize),
        fontWeight: cs.fontWeight,
        color: cs.color,
        liColor: liCs.color,
        width: rect.width,
        height: rect.height,
      };
    });
  });
}

async function shotCrop(page, filename) {
  const box = await page.evaluate(() => {
    const titles = [...document.querySelectorAll('.resume-section li > strong')].filter((el) => {
      const t = el.textContent?.trim();
      return t === 'Pearl' || t === 'On Ice';
    });
    if (titles.length < 2) return null;
    const job = titles[0].closest('.resume-job');
    const r0 = titles[0].closest('li')?.getBoundingClientRect();
    const r1 = titles[1].closest('li')?.getBoundingClientRect();
    if (!r0 || !r1 || !job) return null;
    const top = Math.min(r0.top, r1.top) - 12;
    const bottom = Math.max(r0.bottom, r1.bottom) + 12;
    const left = Math.min(r0.left, r1.left, job.getBoundingClientRect().left) - 8;
    const right = Math.max(r0.right, r1.right, job.getBoundingClientRect().right) + 8;
    return {
      x: Math.max(0, left),
      y: Math.max(0, top),
      width: right - left,
      height: bottom - top,
    };
  });
  if (!box) throw new Error('could not compute crop for Pearl / On Ice');
  await page.screenshot({ path: path.join(outDir, filename), clip: box });
  return box;
}

const desktop = await browser.newPage();
await desktop.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
await desktop.goto(baseUrl, { waitUntil: 'networkidle2', timeout: 90000 });
await desktop.evaluate(() => {
  const pearl = [...document.querySelectorAll('.resume-section li > strong')].find(
    (el) => el.textContent?.trim() === 'Pearl',
  );
  pearl?.closest('.resume-job')?.scrollIntoView({ block: 'center', behavior: 'instant' });
});
await new Promise((r) => setTimeout(r, 300));

const desktopTitles = await measureTitles(desktop);
const bgRgb = await desktop.evaluate(() => {
  const cs = getComputedStyle(document.body);
  return cs.backgroundColor;
});
const bgParsed = parseRgb(bgRgb) || [20, 20, 22];

const desktopWithContrast = desktopTitles.map((row) => {
  const fg = parseRgb(row.color);
  const contrast = fg ? contrastRatio(fg, bgParsed) : null;
  return { ...row, bodyBackground: bgRgb, contrastOnBody: contrast };
});

await shotCrop(desktop, `resume-pearl-onice-crop-${sha}.png`);

const mobile = await browser.newPage();
await mobile.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
await mobile.goto(baseUrl, { waitUntil: 'networkidle2', timeout: 90000 });
await mobile.evaluate(() => {
  const pearl = [...document.querySelectorAll('.resume-section li > strong')].find(
    (el) => el.textContent?.trim() === 'Pearl',
  );
  pearl?.closest('.resume-job')?.scrollIntoView({ block: 'center', behavior: 'instant' });
});
await new Promise((r) => setTimeout(r, 300));
const mobileTitles = await measureTitles(mobile);

await browser.close();

const metrics = {
  baseUrl,
  deploySha: sha,
  capturedAt: new Date().toISOString(),
  desktop: desktopWithContrast,
  mobile: mobileTitles,
  selfCheck: {
    hasPearl: desktopWithContrast.some((t) => t.text === 'Pearl'),
    hasOnIce: desktopWithContrast.some((t) => t.text === 'On Ice'),
    enlarged:
      desktopWithContrast.every((t) => t.fontSizePx >= 17.5) &&
      desktopWithContrast.every((t) => t.fontSizePx > 16),
    accentColor: desktopWithContrast.every((t) => t.color.includes('212') || t.color.includes('d4')),
    contrastOk: desktopWithContrast.every((t) => (t.contrastOnBody ?? 0) >= 4.5),
    mobileReadable: mobileTitles.every((t) => t.fontSizePx >= 17),
    pass:
      desktopWithContrast.length === 2 &&
      desktopWithContrast.every((t) => t.fontSizePx >= 17.5) &&
      desktopWithContrast.every((t) => (t.contrastOnBody ?? 0) >= 4.5) &&
      mobileTitles.length === 2,
  },
};

await writeFile(path.join(outDir, 'resume-pearl-onice-metrics.json'), JSON.stringify(metrics, null, 2));
console.log(JSON.stringify(metrics, null, 2));
process.exit(metrics.selfCheck.pass ? 0 : 1);
