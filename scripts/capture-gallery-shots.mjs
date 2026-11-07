import puppeteer from 'puppeteer-core';
import { mkdir } from 'node:fs/promises';

const outDir = process.argv[2];
const base = 'http://127.0.0.1:4321/projects/work-experience/';

await mkdir(outDir, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: '/usr/local/bin/google-chrome',
  headless: true,
  args: ['--no-sandbox', '--disable-gpu', '--user-data-dir=/tmp/pptr-gallery'],
});

const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
await page.goto(base, { waitUntil: 'networkidle2', timeout: 60000 });
await page.evaluate(() => document.querySelectorAll('.reveal').forEach((el) => el.classList.add('is-visible')));
await new Promise((r) => setTimeout(r, 400));
await page.screenshot({ path: `${outDir}/work-exp-intro-top.png`, fullPage: false });
await page.screenshot({ path: `${outDir}/work-exp-gallery-compact.png` });

await page.click('[data-video-open]');
await page.waitForFunction(() => !document.querySelector('[data-video-modal]').hasAttribute('hidden'), {
  timeout: 5000,
});
await new Promise((r) => setTimeout(r, 500));
await page.screenshot({ path: `${outDir}/work-exp-video-modal.png` });

await browser.close();
console.log('saved', outDir);
