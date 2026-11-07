/**
 * Screenshot Facebook Spaces + Google Play Music Panorama feature cards.
 */
import puppeteer from 'puppeteer-core';

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

const clip = await page.evaluate(() => {
  const a = document.getElementById('facebook-spaces');
  const b = document.getElementById('google-play-music-panorama-festival-nyc-2016');
  if (!a || !b) return null;
  const top = a.getBoundingClientRect().top + window.scrollY - 8;
  const bottom = b.getBoundingClientRect().bottom + window.scrollY + 8;
  return { x: 0, y: top, width: window.innerWidth, height: bottom - top };
});

if (clip) {
  await page.screenshot({ path: `${outDir}/work-exp-panorama-spaces-feature.png`, clip });
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
    const hero = li?.querySelector('.gallery-still-open--hero, .gallery-feature-hero img, .gallery-still-open img');
    const vid = li?.querySelector('.gallery-video-thumb--below-hero, .gallery-video-thumb');
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
