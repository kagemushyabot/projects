import { chromium, devices } from 'playwright';
import { mkdir } from 'node:fs/promises';

const outDir = process.argv[2] || '/cursor/stores/bc-65c722c2-a229-4e4c-b19d-5491ae4cf001/media';
const base = 'http://127.0.0.1:4321/projects';

await mkdir(outDir, { recursive: true });

const browser = await chromium.launch();
const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await desktop.goto(`${base}/work-experience/#custom`, { waitUntil: 'networkidle' });
await desktop.waitForTimeout(800);
await desktop.screenshot({ path: `${outDir}/work-exp-desktop.png`, fullPage: false });

const mobile = await browser.newPage({ ...devices['iPhone 13'] });
await mobile.goto(`${base}/work-experience/#images`, { waitUntil: 'networkidle' });
await mobile.waitForTimeout(600);
await mobile.screenshot({ path: `${outDir}/work-exp-mobile.png`, fullPage: false });

const home = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await home.goto(`${base}/`, { waitUntil: 'networkidle' });
await home.waitForTimeout(1200);
await home.screenshot({ path: `${outDir}/home-desktop.png`, fullPage: false });

await browser.close();
console.log('saved to', outDir);
