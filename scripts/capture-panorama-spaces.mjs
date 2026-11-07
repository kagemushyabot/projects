/**
 * Screenshot Facebook Spaces + Google Play Music Panorama feature cards.
 */
import puppeteer from 'puppeteer-core';
import { writeFileSync } from 'node:fs';

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

async function shotCard(id) {
  const box = await page.evaluate((cardId) => {
    const el = document.getElementById(cardId);
    if (!el) return null;
    el.scrollIntoView({ block: 'center', behavior: 'instant' });
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  }, id);
  if (!box) return null;
  await new Promise((r) => setTimeout(r, 250));
  return page.screenshot({ encoding: 'base64', clip: { ...box, x: Math.max(0, box.x - 4), width: box.width + 8, height: box.height + 8 } });
}

const fbB64 = await shotCard('facebook-spaces');
const gpB64 = await shotCard('google-play-music-panorama-festival-nyc-2016');

if (fbB64 && gpB64) {
  const stitched = await page.evaluate(
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
    12,
  );
  writeFileSync(`${outDir}/work-exp-panorama-spaces-feature.png`, Buffer.from(stitched, 'base64'));
}

const mobile = await browser.newPage();
await mobile.setViewport({ width: 390, height: 844 });
await mobile.goto(base, { waitUntil: 'networkidle2', timeout: 90000 });
await mobile.evaluate(() => document.querySelectorAll('.reveal').forEach((el) => el.classList.add('is-visible')));
await new Promise((r) => setTimeout(r, 600));
await mobile.screenshot({ path: `${outDir}/work-exp-panorama-spaces-mobile.png`, fullPage: false });

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
  };
});

console.log(JSON.stringify(sizes, null, 2));
await browser.close();
