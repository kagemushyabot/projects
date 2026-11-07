/**
 * Assert feature / spotlight hero stills decode with non-black center pixels after scroll.
 */
import puppeteer from 'puppeteer-core';

const origin = process.env.PREVIEW_ORIGIN || 'https://kagemushyabot.github.io';
const base = `${origin}${process.env.PREVIEW_BASE_PATH || '/projects/work-experience/'}?v=${Date.now()}`;

const HERO_SELECTORS = [
  '#water-is-life-hidden-dangers-vr-campaign .gallery-feature-hero img',
  '#pearl .gallery-spotlight-film__hero img',
  '#on-ice .gallery-spotlight-film__hero img',
  '#facebook-spaces .gallery-feature-hero img',
  '#google-play-music-panorama-festival-nyc-2016 .gallery-feature-hero img',
];

const browser = await puppeteer.launch({
  executablePath: '/usr/local/bin/google-chrome',
  headless: true,
  args: ['--no-sandbox', '--disable-gpu'],
});

const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
await page.goto(base, { waitUntil: 'networkidle2', timeout: 90000 });

for (const sel of HERO_SELECTORS) {
  await page.evaluate((s) => {
    document.querySelector(s)?.scrollIntoView({ block: 'center', behavior: 'instant' });
  }, sel);
  await new Promise((r) => setTimeout(r, 350));
}

const report = await page.evaluate(async (selectors) => {
  const sample = async (img) => {
    if (!img?.complete || img.naturalWidth === 0) return { ok: false, reason: 'not-loaded' };
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 16;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, 16, 16);
    const pts = [
      [8, 8],
      [4, 4],
      [12, 12],
    ];
    const pixels = pts.map(([x, y]) => {
      const d = ctx.getImageData(x, y, 1, 1).data;
      return [d[0], d[1], d[2], d[3]];
    });
    const luminance = (p) => 0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2];
    const maxLum = Math.max(...pixels.map(luminance));
    const cs = getComputedStyle(img);
    const r = img.getBoundingClientRect();
    return {
      ok: maxLum > 18 && r.width > 80 && r.height > 80,
      maxLum,
      pixels,
      rect: { w: Math.round(r.width), h: Math.round(r.height) },
      opacity: cs.opacity,
    };
  };
  const out = [];
  for (const sel of selectors) {
    const img = document.querySelector(sel);
    out.push({ sel, ...(await sample(img)) });
  }
  return out;
}, HERO_SELECTORS);

const failed = report.filter((r) => !r.ok);
console.log(JSON.stringify({ report, failed: failed.length }, null, 2));
await browser.close();
process.exit(failed.length > 0 ? 1 : 0);
