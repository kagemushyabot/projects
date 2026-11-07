/**
 * Screenshot Facebook Spaces + Google Play Music Panorama feature cards.
 */
import puppeteer from 'puppeteer-core';
import { writeFileSync, readFileSync } from 'node:fs';

const outDir = process.argv[2] || '/cursor/stores/self/media';
const origin = process.env.PREVIEW_ORIGIN || 'https://kagemushyabot.github.io';
const base = `${origin}${process.env.PREVIEW_BASE_PATH || '/projects/work-experience/'}?v=${Date.now()}`;

const browser = await puppeteer.launch({
  executablePath: '/usr/local/bin/google-chrome',
  headless: true,
  args: ['--no-sandbox', '--disable-gpu'],
});

const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
await page.goto(base, { waitUntil: 'networkidle2', timeout: 90000 });
await page.evaluate(() => document.querySelectorAll('.reveal').forEach((el) => el.classList.add('is-visible')));
await page.waitForFunction(
  () => {
    const fb = document.querySelector('#facebook-spaces .gallery-still-open img');
    const gp = document.querySelector('#google-play-music-panorama-festival-nyc-2016 .gallery-still-open img');
    return fb?.naturalWidth > 0 && gp?.naturalWidth > 0;
  },
  { timeout: 30000 },
);

async function shotCard(id, path) {
  await page.evaluate((cardId) => {
    document.getElementById(cardId)?.scrollIntoView({ block: 'start', behavior: 'instant' });
  }, id);
  await new Promise((r) => setTimeout(r, 450));
  const box = await page.evaluate((cardId) => {
    const el = document.getElementById(cardId);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (r.height < 80) return null;
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  }, id);
  if (!box) return false;
  const buf = await page.screenshot({
    captureBeyondViewport: true,
    clip: {
      x: Math.max(0, box.x),
      y: Math.max(0, box.y),
      width: Math.min(box.width, 1440),
      height: box.height,
    },
  });
  writeFileSync(path, buf);
  return true;
}

const fbPath = `${outDir}/.panorama-fb-tile.png`;
const gpPath = `${outDir}/.panorama-gp-tile.png`;
const fbOk = await shotCard('facebook-spaces', fbPath);
const gpOk = await shotCard('google-play-music-panorama-festival-nyc-2016', gpPath);

if (fbOk && gpOk) {
  const fbB64 = readFileSync(fbPath).toString('base64');
  const gpB64 = readFileSync(gpPath).toString('base64');
  const stitchPage = await browser.newPage();
  const stitchedB64 = await stitchPage.evaluate(
    async (a, b, gap) => {
      const load = (src) =>
        new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = reject;
          img.src = src;
        });
      const imgA = await load(`data:image/png;base64,${a}`);
      const imgB = await load(`data:image/png;base64,${b}`);
      const w = Math.max(imgA.width, imgB.width);
      const h = imgA.height + gap + imgB.height;
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#050508';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(imgA, 0, 0);
      ctx.drawImage(imgB, 0, imgA.height + gap);
      return canvas.toDataURL('image/png').split(',')[1];
    },
    fbB64,
    gpB64,
    16,
  );
  writeFileSync(`${outDir}/work-exp-panorama-spaces-feature.png`, Buffer.from(stitchedB64, 'base64'));
  await stitchPage.close();
}

const mobile = await browser.newPage();
await mobile.setViewport({ width: 390, height: 844 });
await mobile.goto(base, { waitUntil: 'networkidle2', timeout: 90000 });
await mobile.evaluate(() => document.querySelectorAll('.reveal').forEach((el) => el.classList.add('is-visible')));
await mobile.evaluate(() => document.getElementById('facebook-spaces')?.scrollIntoView({ block: 'start' }));
await new Promise((r) => setTimeout(r, 500));
const mobileBox = await mobile.evaluate(() => {
  const ids = ['facebook-spaces', 'google-play-music-panorama-festival-nyc-2016'];
  let top = Infinity;
  let bottom = 0;
  let width = 0;
  for (const id of ids) {
    const r = document.getElementById(id)?.getBoundingClientRect();
    if (!r) continue;
    top = Math.min(top, r.y);
    bottom = Math.max(bottom, r.y + r.height);
    width = Math.max(width, r.width);
  }
  return { x: 0, y: Math.max(0, top - 8), width, height: bottom - top + 16 };
});
await mobile.screenshot({
  path: `${outDir}/work-exp-panorama-spaces-mobile.png`,
  clip: mobileBox,
  captureBeyondViewport: true,
});

const sizes = await page.evaluate(() => {
  const m = (id) => {
    const li = document.getElementById(id);
    const hero = li?.querySelector('.gallery-still-open img');
    const vid = li?.querySelector('.gallery-video-thumb');
    return {
      li: li ? Math.round(li.getBoundingClientRect().width) : null,
      hero: hero ? Math.round(hero.getBoundingClientRect().width) : null,
      video: vid ? Math.round(vid.getBoundingClientRect().width) : null,
    };
  };
  return {
    desktop: { facebook: m('facebook-spaces'), panorama: m('google-play-music-panorama-festival-nyc-2016') },
    mobile: m('facebook-spaces'),
  };
});

console.log(JSON.stringify(sizes, null, 2));
await browser.close();
