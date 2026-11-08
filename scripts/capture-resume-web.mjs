import puppeteer from 'puppeteer-core';
import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const outDir = process.argv[2];
const baseUrl = process.argv[3];
const sha = process.argv[4] || 'local';

if (!outDir || !baseUrl) {
  console.error('usage: npx vite-node scripts/capture-resume-web.mjs <outDir> <resumeUrl> [sha]');
  process.exit(1);
}

await mkdir(outDir, { recursive: true });

function countPdfPages(buffer) {
  const tmp = `/tmp/resume-print-${process.pid}.pdf`;
  writeFileSync(tmp, buffer);
  try {
    const raw = execSync(`strings ${tmp} | rg '^/Count' | head -1`, { encoding: 'utf8' }).trim();
    const m = raw.match(/Count\s+(\d+)/);
    if (m) return parseInt(m[1], 10);
  } catch {
    /* ignore */
  }
  try {
    const info = execSync(`mutool info ${tmp} 2>/dev/null || true`, { encoding: 'utf8' });
    const m = info.match(/Pages:\s*(\d+)/i);
    if (m) return parseInt(m[1], 10);
  } catch {
    /* ignore */
  }
  return null;
}

const browser = await puppeteer.launch({
  executablePath: '/usr/local/bin/google-chrome',
  headless: true,
  args: ['--no-sandbox', '--disable-gpu', `--user-data-dir=/tmp/pptr-resume-${process.pid}`],
});

async function captureDesktop() {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await page.goto(baseUrl, { waitUntil: 'networkidle2', timeout: 90000 });
  await page.emulateMediaType('print');
  const checks = await page.evaluate(() => ({
    hasSplattic: document.body.textContent?.includes('no programming background') ?? false,
    hasSpyPost: document.body.textContent?.includes('SPY POST') ?? false,
    hasHonolulu: document.body.textContent?.includes('Honolulu, HI') ?? false,
    hasFilmDisclaimer: document.body.textContent?.includes('not individual Academy') ?? false,
    pdfLink: !!document.querySelector('a[href*="Jun_Nagaoka_Resume_2027_v8.pdf"]'),
    overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  }));
  await page.screenshot({
    path: path.join(outDir, `resume-web-desktop-${sha}.png`),
    fullPage: true,
  });
  const pdfBuffer = await page.pdf({
    format: 'Letter',
    printBackground: true,
    margin: { top: '0.42in', right: '0.48in', bottom: '0.42in', left: '0.48in' },
  });
  const printPageCount = countPdfPages(pdfBuffer);
  await page.close();
  return { checks, printPageCount };
}

async function captureMobile() {
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
  await page.goto(baseUrl, { waitUntil: 'networkidle2', timeout: 90000 });
  const overflowX = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  await page.screenshot({
    path: path.join(outDir, `resume-web-mobile-${sha}.png`),
    fullPage: true,
  });
  await page.close();
  return { overflowX };
}

const desktop = await captureDesktop();
const mobile = await captureMobile();
await browser.close();

const metrics = {
  baseUrl,
  deploySha: sha,
  capturedAt: new Date().toISOString(),
  desktop,
  mobile,
  selfCheck: {
    splatticFact: desktop.checks.hasSplattic,
    spyPost: desktop.checks.hasSpyPost,
    honolulu: desktop.checks.hasHonolulu,
    filmDisclaimer: desktop.checks.hasFilmDisclaimer,
    pdfLink: desktop.checks.pdfLink,
    desktopNoOverflow: !desktop.checks.overflowX,
    mobileNoOverflow: !mobile.overflowX,
    printOnePage: desktop.printPageCount === 1,
    printPageCount: desktop.printPageCount,
    pass:
      desktop.checks.hasSplattic &&
      desktop.checks.hasSpyPost &&
      desktop.checks.hasHonolulu &&
      desktop.checks.hasFilmDisclaimer &&
      desktop.checks.pdfLink &&
      !desktop.checks.overflowX &&
      !mobile.overflowX &&
      desktop.printPageCount === 1,
  },
};

await writeFile(path.join(outDir, 'resume-web-metrics.json'), JSON.stringify(metrics, null, 2));
console.log(JSON.stringify(metrics, null, 2));
process.exit(metrics.selfCheck.pass ? 0 : 1);
