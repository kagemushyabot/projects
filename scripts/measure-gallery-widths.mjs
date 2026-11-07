/**
 * Measure key gallery boundingClientRect widths on live or preview URL.
 * Usage: node scripts/measure-gallery-widths.mjs [url]
 */
import puppeteer from 'puppeteer-core';

const url =
  process.argv[2] ||
  `https://kagemushyabot.github.io/projects/work-experience/?v=${Date.now()}`;

const browser = await puppeteer.launch({
  executablePath: '/usr/local/bin/google-chrome',
  headless: true,
  args: ['--no-sandbox', '--disable-gpu'],
});

const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
await page.goto(url, { waitUntil: 'networkidle2', timeout: 90000 });
await page.waitForFunction(
  () => {
    const w = document.querySelector('#water-is-life-hidden-dangers-vr-campaign [data-media-grid] img[src*="water"]');
    const p = document.querySelector('#pearl [data-film-hero] img, #pearl .gallery-spotlight-film__hero img');
    return w?.naturalWidth > 0 && p?.naturalWidth > 0;
  },
  { timeout: 30000 },
);

const report = await page.evaluate(() => {
  const rect = (el) => (el ? Math.round(el.getBoundingClientRect().width) : null);
  const water = document.getElementById('water-is-life-hidden-dangers-vr-campaign');
  const band = document.getElementById('google-spotlight-stories-group');
  const waterHero = water?.querySelector('.gallery-feature-hero img[src*="water"], img[src*="water-is-life"]');
  const pearlHero = document.querySelector('#pearl .gallery-spotlight-film__hero img[src*="image3"]');
  const pearlThumb = document.querySelector('#pearl .gallery-spotlight-film__videos .gallery-video-thumb img');
  return {
    viewport: window.innerWidth,
    waterLi: rect(water),
    spotlightBandLi: rect(band),
    widthDelta: water && band ? Math.round(band.getBoundingClientRect().width - water.getBoundingClientRect().width) : null,
    waterHero: rect(waterHero),
    pearlHero: rect(pearlHero),
    heroDelta: waterHero && pearlHero ? Math.round(pearlHero.getBoundingClientRect().width - waterHero.getBoundingClientRect().width) : null,
    pearlThumb: rect(pearlThumb),
    titles: [...document.querySelectorAll('.gallery-card-title, .gallery-spotlight-group__title, .gallery-spotlight-film__title')]
      .map((el) => el.textContent?.trim())
      .filter((t) => /Water|Spotlight|Pearl|On Ice|Monterey/i.test(t || '')),
    pearlTitleCount: [...document.querySelectorAll('.gallery-spotlight-film__title')].filter((el) => el.textContent?.trim() === 'Pearl').length,
    featurePromo: ['facebook-spaces', 'google-play-music-panorama-festival-nyc-2016'].map((id) => {
      const li = document.getElementById(id);
      const hero = li?.querySelector('.gallery-still-open img[src*="wp-import"], .gallery-feature-hero img');
      const vid = li?.querySelector('.gallery-video-thumb img');
      return {
        id,
        liWidth: li ? Math.round(li.getBoundingClientRect().width) : null,
        className: li?.className ?? '',
        heroWidth: hero ? Math.round(hero.getBoundingClientRect().width) : null,
        videoWidth: vid ? Math.round(vid.getBoundingClientRect().width) : null,
      };
    }),
  };
});

console.log(JSON.stringify(report, null, 2));
await browser.close();
