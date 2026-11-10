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
  const checks = await page.evaluate(() => {
    const text = document.body.textContent || '';
    const disclaimerPatterns = [
      /not personal award/i,
      /not individual academy/i,
      /the films, not/i,
      /not identical/i,
      /selected credits/i,
      /recent focus/i,
    ];
    const employers = [...document.querySelectorAll('.resume-job h3')].map((el) => el.textContent?.trim());
    return {
      hasSplattic: text.includes('no programming background'),
      hasSpyPost: text.includes('SPY POST'),
      hasHonolulu: text.includes('Honolulu, HI'),
      hasPearlNominee: /Oscar nominee|Academy Award nominee/i.test(text) && text.includes('Pearl'),
      hasOnIceNominee: /Annie Award nominee/i.test(text) && text.includes('On Ice'),
      disclaimerHits: disclaimerPatterns.filter((re) => re.test(text)).map(String),
      pdfLink: !!document.querySelector('a[href*="Jun_Nagaoka_Resume_2027.pdf"]'),
      overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      employers,
      hasTacticFirst: employers[0]?.includes('Tactic Studio'),
      hasProfessionalExperience: text.includes('Professional Experience'),
    };
  });
  const root = await page.$('.resume-page');
  if (root) {
    await root.screenshot({ path: path.join(outDir, `resume-web-desktop-${sha}.png`) });
  } else {
    await page.screenshot({ path: path.join(outDir, `resume-web-desktop-${sha}.png`), fullPage: true });
  }
  const contrast = await page.evaluate(() => {
    const h3 = document.querySelector('.resume-job h3');
    const li = document.querySelector('.resume-section li');
    const link = document.querySelector('.resume-page a[href^="http"]');
    function ratio(el) {
      if (!el) return null;
      const fg = getComputedStyle(el).color;
      const bg = getComputedStyle(document.body).backgroundColor;
      const parse = (c) => {
        const m = c.match(/[\d.]+/g);
        if (!m) return null;
        return m.slice(0, 3).map(Number);
      };
      const f = parse(fg);
      const b = parse(bg);
      if (!f || !b) return null;
      const lum = (rgb) => {
        const [r, g, bl] = rgb.map((v) => {
          const x = v / 255;
          return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
      };
      const L1 = lum(f);
      const L2 = lum(b);
      const bright = Math.max(L1, L2);
      const dark = Math.min(L1, L2);
      return (bright + 0.05) / (dark + 0.05);
    }
    return { jobTitleContrast: ratio(h3), listContrast: ratio(li), linkContrast: ratio(link) };
  });

  await page.emulateMediaType('print');
  const printContrast = await page.evaluate(() => {
    const h3 = document.querySelector('.resume-job h3');
    const fg = getComputedStyle(h3).color;
    const bg = getComputedStyle(document.body).backgroundColor;
    return { printJobColor: fg, printBg: bg };
  });
  await page.emulateMediaType('screen');

  const pdfBuffer = await page.pdf({
    format: 'Letter',
    printBackground: true,
    margin: { top: '0.5in', right: '0.5in', bottom: '0.5in', left: '0.5in' },
  });
  const printPageCount = countPdfPages(pdfBuffer);
  await page.close();
  return { checks, printPageCount, contrast, printContrast };
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
    pearlOnIce: desktop.checks.hasPearlNominee && desktop.checks.hasOnIceNominee,
    noDisclaimers: (desktop.checks.disclaimerHits?.length ?? 0) === 0,
    timelineOrder: desktop.checks.hasTacticFirst && desktop.checks.hasProfessionalExperience,
    contrastOk:
      (desktop.contrast?.jobTitleContrast ?? 0) >= 4.5 && (desktop.contrast?.listContrast ?? 0) >= 4.5,
    pdfLink: desktop.checks.pdfLink,
    desktopNoOverflow: !desktop.checks.overflowX,
    mobileNoOverflow: !mobile.overflowX,
    printPageCount: desktop.printPageCount,
    pass:
      desktop.checks.hasSplattic &&
      desktop.checks.hasSpyPost &&
      desktop.checks.hasHonolulu &&
      desktop.checks.hasPearlNominee &&
      desktop.checks.hasOnIceNominee &&
      (desktop.checks.disclaimerHits?.length ?? 0) === 0 &&
      desktop.checks.hasTacticFirst &&
      desktop.checks.pdfLink &&
      !desktop.checks.overflowX &&
      !mobile.overflowX &&
      (desktop.contrast?.jobTitleContrast ?? 0) >= 4.5,
  },
};

await writeFile(path.join(outDir, 'resume-web-metrics.json'), JSON.stringify(metrics, null, 2));
console.log(JSON.stringify(metrics, null, 2));
process.exit(metrics.selfCheck.pass ? 0 : 1);
