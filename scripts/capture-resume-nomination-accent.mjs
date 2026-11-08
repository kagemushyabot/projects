import puppeteer from 'puppeteer-core';
import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const outDir = process.argv[2];
const baseUrl = process.argv[3];
const sha = process.argv[4] || 'local';

if (!outDir || !baseUrl) {
  console.error(
    'usage: npx vite-node scripts/capture-resume-nomination-accent.mjs <outDir> <resumeUrl> [sha]',
  );
  process.exit(1);
}

await mkdir(outDir, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: '/usr/local/bin/google-chrome',
  headless: true,
  args: ['--no-sandbox', '--disable-gpu', `--user-data-dir=/tmp/pptr-nom-${process.pid}`],
});

const desktop = await browser.newPage();
await desktop.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
await desktop.goto(baseUrl, { waitUntil: 'networkidle2', timeout: 90000 });
await desktop.evaluate(() => {
  const first = document.querySelector('.resume-accent-nomination');
  first?.closest('.resume-job')?.scrollIntoView({ block: 'center', behavior: 'instant' });
});
await new Promise((r) => setTimeout(r, 350));

const phrases = await desktop.evaluate(() =>
  [...document.querySelectorAll('.resume-accent-nomination')].map((el) => {
    const cs = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    return {
      text: el.textContent?.trim(),
      fontSizePx: parseFloat(cs.fontSize),
      fontWeight: cs.fontWeight,
      color: cs.color,
      width: rect.width,
      height: rect.height,
    };
  }),
);

const handle = await desktop.evaluateHandle(() => {
  const nodes = [...document.querySelectorAll('.resume-accent-nomination')];
  if (nodes.length < 2) return null;
  const job = nodes[0].closest('.resume-job');
  const ul = job?.querySelector('ul');
  return ul;
});
const ul = handle.asElement();
if (!ul) throw new Error('evil eye ul not found');
await ul.screenshot({ path: path.join(outDir, `resume-nomination-phrases-${sha}.png`) });

const mobile = await browser.newPage();
await mobile.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
await mobile.goto(baseUrl, { waitUntil: 'networkidle2' });
const mobilePhrases = await mobile.evaluate(() =>
  [...document.querySelectorAll('.resume-accent-nomination')].map((el) => {
    const cs = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    return {
      text: el.textContent?.trim(),
      fontSizePx: parseFloat(cs.fontSize),
      width: rect.width,
      wraps: rect.height > parseFloat(cs.fontSize) * 1.6,
    };
  }),
);

await browser.close();

const metrics = {
  baseUrl,
  deploySha: sha,
  capturedAt: new Date().toISOString(),
  desktop: phrases,
  mobile: mobilePhrases,
  selfCheck: {
    count: phrases.length === 2,
    pearlPhrase: phrases.some((p) => p.text?.includes('Academy Award nominee')),
    anniePhrase: phrases.some((p) => p.text?.includes('Annie Award nominee')),
    sizeOk: phrases.every((p) => p.fontSizePx >= 17.5),
    colorOk: phrases.every((p) => p.color === 'rgb(212, 180, 131)'),
    weightOk: phrases.every((p) => p.fontWeight === '600'),
    mobileReadable: mobilePhrases.every((p) => p.fontSizePx >= 17.5),
    pass:
      phrases.length === 2 &&
      phrases.every((p) => p.fontSizePx >= 17.5 && p.fontWeight === '600' && p.color === 'rgb(212, 180, 131)'),
  },
};

await writeFile(path.join(outDir, 'resume-nomination-accent-metrics.json'), JSON.stringify(metrics, null, 2));
console.log(JSON.stringify(metrics, null, 2));
process.exit(metrics.selfCheck.pass ? 0 : 1);
