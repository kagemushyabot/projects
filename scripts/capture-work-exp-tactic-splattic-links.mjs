import puppeteer from 'puppeteer-core';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const outDir = process.argv[2];
const baseUrl = process.argv[3];
const sha = process.argv[4] || 'local';

if (!outDir || !baseUrl) {
  console.error(
    'usage: npx vite-node scripts/capture-work-exp-tactic-splattic-links.mjs <outDir> <workExpUrl> [sha]',
  );
  process.exit(1);
}

await mkdir(outDir, { recursive: true });

const EXPECTED = [
  {
    block: 'tactic',
    href: 'https://tactic.studio/',
    selector: '.work-intro-block--tactic a.work-intro-visual--external',
  },
  {
    block: 'splattic',
    href: 'https://www.splattic.com/',
    selector: '.work-intro-block--splattic a.work-intro-visual--external',
  },
];

const browser = await puppeteer.launch({
  executablePath: '/usr/local/bin/google-chrome',
  headless: true,
  args: ['--no-sandbox', '--disable-gpu', `--user-data-dir=/tmp/pptr-intro-links-${process.pid}`],
});

const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
await page.goto(baseUrl, { waitUntil: 'networkidle2', timeout: 90000 });
await page.evaluate(() => document.querySelectorAll('.reveal').forEach((el) => el.classList.add('is-visible')));

const probe = await page.evaluate((rows) => {
  return rows.map((row) => {
    const el = document.querySelector(row.selector);
    if (!el) return { ...row, found: false };
    const hasLightbox = el.hasAttribute('data-image-open');
    return {
      block: row.block,
      found: true,
      href: el.getAttribute('href'),
      expectedHref: row.href,
      target: el.getAttribute('target'),
      hasLightbox,
      tag: el.tagName,
    };
  });
}, EXPECTED);

let modalOpened = false;
page.on('dialog', () => {});

await page.evaluate(() => {
  document.querySelector('.work-intro-block--tactic a.work-intro-visual--external')?.scrollIntoView({
    block: 'center',
    behavior: 'instant',
  });
});
const tacticClick = await page.evaluate(() => {
  const el = document.querySelector('.work-intro-block--tactic a.work-intro-visual--external');
  return { tag: el?.tagName, hasDataImageOpen: el?.hasAttribute('data-image-open') ?? null };
});
await page.click('.work-intro-block--tactic a.work-intro-visual--external', {
  button: 'middle',
  delay: 10,
}).catch(() => {});
await new Promise((r) => setTimeout(r, 300));
modalOpened = await page.evaluate(
  () => !!document.querySelector('.portfolio-image-modal.is-open, [data-image-modal].is-open, dialog[open]'),
);

const metrics = {
  baseUrl,
  sha,
  capturedAt: new Date().toISOString(),
  probe,
  tacticClick,
  modalOpenedAfterMiddleClick: modalOpened,
  selfCheck: {
    allFound: probe.every((p) => p.found),
    hrefsOk: probe.every((p) => p.href === p.expectedHref),
    noLightboxAttrs: probe.every((p) => !p.hasLightbox),
    externalTabs: probe.every((p) => p.target === '_blank'),
    pass:
      probe.every((p) => p.found && p.href === p.expectedHref && !p.hasLightbox && p.target === '_blank'),
  },
};

await writeFile(path.join(outDir, `work-exp-tactic-splattic-links-${sha}.json`), JSON.stringify(metrics, null, 2));
await browser.close();
console.log(JSON.stringify(metrics, null, 2));
process.exit(metrics.selfCheck.pass ? 0 : 1);
