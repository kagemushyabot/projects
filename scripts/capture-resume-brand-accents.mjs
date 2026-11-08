import puppeteer from 'puppeteer-core';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const outDir = process.argv[2];
const baseUrl = process.argv[3];
const sha = process.argv[4] || 'local';

if (!outDir || !baseUrl) {
  console.error(
    'usage: npx vite-node scripts/capture-resume-brand-accents.mjs <outDir> <resumeUrl> [sha]',
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

const bgRgb = [6, 6, 7];

const disclaimerPatterns = [
  /not personal award/i,
  /not individual academy/i,
  /the films, not/i,
  /not identical/i,
  /selected credits/i,
  /recent focus/i,
];

const browser = await puppeteer.launch({
  executablePath: '/usr/local/bin/google-chrome',
  headless: true,
  args: ['--no-sandbox', '--disable-gpu', `--user-data-dir=/tmp/pptr-brands-${process.pid}`],
});

const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
await page.goto(baseUrl, { waitUntil: 'networkidle2', timeout: 90000 });

const pageText = await page.evaluate(() => document.body.textContent || '');
const disclaimerHits = disclaimerPatterns.filter((re) => re.test(pageText)).map(String);

async function scrollToHeading(text) {
  await page.evaluate((t) => {
    const h = [...document.querySelectorAll('.resume-job h3')].find((el) => el.textContent?.includes(t));
    h?.closest('.resume-job')?.scrollIntoView({ block: 'start', behavior: 'instant' });
  }, text);
  await new Promise((r) => setTimeout(r, 280));
}

async function shotTacticBrandsLi(filename) {
  const box = await page.evaluate(() => {
    const li = [...document.querySelectorAll('li')].find((el) => el.textContent?.includes('Selected projects:'));
    if (!li || !li.querySelector('.resume-accent-name')) return null;
    li.closest('.resume-job')?.scrollIntoView({ block: 'start', behavior: 'instant' });
    const r = li.getBoundingClientRect();
    return {
      x: Math.max(0, r.x - 8),
      y: Math.max(0, r.y - 6),
      width: r.width + 16,
      height: r.height + 12,
    };
  });
  if (!box) throw new Error('tactic brands clip failed');
  await new Promise((r) => setTimeout(r, 200));
  await page.screenshot({ path: path.join(outDir, filename), clip: box });
  return box;
}

async function shotJobContains(headingNeedle, filename, mustIncludeText) {
  const box = await page.evaluate(
    (heading, mustText) => {
      const job = [...document.querySelectorAll('.resume-job')].find((el) =>
        el.querySelector('h3')?.textContent?.includes(heading),
      );
      if (!job) return null;
      const body = job.textContent || '';
      if (mustText && !body.includes(mustText)) return null;
      const accents = job.querySelectorAll('.resume-accent-name');
      if (!accents.length) return null;
      const rects = [...accents].map((a) => a.getBoundingClientRect());
      const jr = job.getBoundingClientRect();
      const top = Math.min(jr.top, ...rects.map((r) => r.top)) - 8;
      const bottom = Math.max(jr.bottom, ...rects.map((r) => r.bottom)) + 8;
      const left = Math.min(jr.left, ...rects.map((r) => r.left)) - 8;
      const right = Math.max(jr.right, ...rects.map((r) => r.right)) + 8;
      return {
        x: Math.max(0, left),
        y: Math.max(0, top),
        width: right - left,
        height: Math.min(860, bottom - top),
      };
    },
    headingNeedle,
    mustIncludeText,
  );
  if (!box || box.height < 40) throw new Error(`clip failed for ${headingNeedle}`);
  await page.screenshot({ path: path.join(outDir, filename), clip: box });
  return box;
}

async function shotPearlRow(filename) {
  const box = await page.evaluate(() => {
    const pearl = [...document.querySelectorAll('.resume-accent-name')].find(
      (el) => el.textContent?.trim() === 'Pearl',
    );
    const onIce = [...document.querySelectorAll('.resume-accent-name')].find(
      (el) => el.textContent?.trim() === 'On Ice',
    );
    if (!pearl || !onIce) return null;
    pearl.closest('.resume-job')?.scrollIntoView({ block: 'center', behavior: 'instant' });
    const li0 = pearl.closest('li')?.getBoundingClientRect();
    const li1 = onIce.closest('li')?.getBoundingClientRect();
    if (!li0 || !li1) return null;
    const top = Math.min(li0.top, li1.top) - 10;
    const bottom = Math.max(li0.bottom, li1.bottom) + 10;
    const job = pearl.closest('.resume-job');
    const jr = job?.getBoundingClientRect();
    const left = (jr?.left ?? li0.left) - 6;
    const right = Math.max(li0.right, li1.right, jr?.right ?? 0) + 6;
    return {
      x: Math.max(0, left),
      y: Math.max(0, top),
      width: right - left,
      height: bottom - top,
    };
  });
  if (!box) throw new Error('pearl row clip failed');
  await new Promise((r) => setTimeout(r, 200));
  await page.screenshot({ path: path.join(outDir, filename), clip: box });
  return box;
}

async function shotProjectsMontage(filename) {
  const box = await page.evaluate(() => {
    const bloodJob = [...document.querySelectorAll('.resume-job')].find((j) => {
      const h = j.querySelector('h3')?.textContent || '';
      return h.includes('DeNA West') && (j.querySelector('.dates')?.textContent || '').includes('December 2014');
    });
    const insightJob = [...document.querySelectorAll('.resume-job')].find((j) =>
      j.querySelector('h3')?.textContent?.includes('Insight Digital, Emeryville'),
    );
    if (!bloodJob || !insightJob) return null;
    insightJob.scrollIntoView({ block: 'center', behavior: 'instant' });
    const insightLi = [...insightJob.querySelectorAll('li')].find((li) =>
      li.textContent?.includes('Trésors engloutis'),
    );
    if (!insightLi) return null;
    bloodJob.scrollIntoView({ block: 'start', behavior: 'instant' });
    const br = bloodJob.getBoundingClientRect();
    const ir = insightLi.getBoundingClientRect();
    const left = Math.min(br.left, ir.left) - 10;
    const right = Math.max(br.right, ir.right) + 10;
    const top = Math.min(br.top, ir.top) - 8;
    const bottom = Math.max(br.bottom, ir.bottom) + 8;
    const height = bottom - top;
    if (height > 820) {
      const jr = insightLi.getBoundingClientRect();
      return {
        x: Math.max(0, jr.x - 10),
        y: Math.max(0, jr.y - 8),
        width: jr.width + 20,
        height: jr.height + 16,
      };
    }
    return {
      x: Math.max(0, left),
      y: Math.max(0, top),
      width: right - left,
      height,
    };
  });
  if (!box) throw new Error('projects montage failed');
  await new Promise((r) => setTimeout(r, 200));
  await page.screenshot({ path: path.join(outDir, filename), clip: box });
  return box;
}

await scrollToHeading('Tactic Studio');
await shotTacticBrandsLi(`resume-accent-tactic-brands-${sha}.png`);
await shotPearlRow(`resume-accent-pearl-row-${sha}.png`);
await shotProjectsMontage(`resume-accent-projects-${sha}.png`);

const byCategory = await page.evaluate(() => {
  function catFor(el) {
    const job = el.closest('.resume-job');
    const h = job?.querySelector('h3')?.textContent?.trim() || 'unknown';
    if (h.includes('Tactic')) return 'tactic-brands';
    if (h.includes('Evil Eye')) return 'evil-eye-films';
    if (h.includes('DeNA')) return 'dena-titles';
    if (h.includes('Insight Digital') && h.includes('Emeryville, CA')) return 'insight-recent';
    if (h.includes('Ntropic')) return 'ntropic';
    if (h.includes('Floathybrid')) return 'floathybrid';
    if (h.includes('Insight Digital') && !h.includes('CA')) return 'insight-earlier';
    if (h.includes('Black Point')) return 'black-point';
    if (h.includes('Mondo')) return 'mondo';
    return 'other';
  }
  return [...document.querySelectorAll('.resume-accent-name')].map((el) => {
    const cs = getComputedStyle(el);
    return {
      text: el.textContent?.trim(),
      category: catFor(el),
      fontSizePx: parseFloat(cs.fontSize),
      fontWeight: cs.fontWeight,
      color: cs.color,
    };
  });
});

const categories = {};
for (const row of byCategory) {
  if (!categories[row.category]) categories[row.category] = [];
  categories[row.category].push({
    ...row,
    contrastOnBody: (() => {
      const fg = parseRgb(row.color);
      return fg ? contrastRatio(fg, bgRgb) : null;
    })(),
  });
}

const sampleCheck = (cat) => {
  const rows = categories[cat] || [];
  if (!rows.length) return false;
  return rows.every(
    (r) => r.fontSizePx >= 17.5 && r.fontWeight === '600' && (r.contrastOnBody ?? 0) >= 4.5,
  );
};

await browser.close();

const metrics = {
  baseUrl,
  deploySha: sha,
  capturedAt: new Date().toISOString(),
  accentNameCount: byCategory.length,
  wrappedNames: byCategory.map((r) => r.text),
  categories,
  disclaimerHits,
  selfCheck: {
    noDisclaimers: disclaimerHits.length === 0,
    pearlVisible: byCategory.some((r) => r.text === 'Pearl'),
    tacticBrands: sampleCheck('tactic-brands'),
    evilEye: sampleCheck('evil-eye-films'),
    denaTitles: sampleCheck('dena-titles'),
    insightEarlier: sampleCheck('insight-earlier'),
    blackPoint: sampleCheck('black-point'),
    mondo: sampleCheck('mondo'),
    allUniform:
      byCategory.length >= 20 &&
      byCategory.every(
        (r) =>
          parseFloat(String(r.fontSizePx)) >= 17.5 &&
          r.fontWeight === '600' &&
          r.color === 'rgb(212, 180, 131)',
      ),
    pass:
      disclaimerHits.length === 0 &&
      byCategory.length >= 20 &&
      byCategory.every((r) => r.text !== 'DeNA') &&
      sampleCheck('tactic-brands') &&
      sampleCheck('evil-eye-films'),
  },
};

await writeFile(path.join(outDir, 'resume-brand-accents-metrics.json'), JSON.stringify(metrics, null, 2));
console.log(JSON.stringify(metrics, null, 2));
process.exit(metrics.selfCheck.pass ? 0 : 1);
