import puppeteer from 'puppeteer-core';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const outDir = process.argv[2];
const baseUrl =
  process.argv[3] ?? 'https://kagemushyabot.github.io/projects/work-experience/?v=' + Date.now();

if (!outDir) {
  console.error('usage: node scripts/audit-gallery-media-pairs.mjs <outDir> [baseUrl]');
  process.exit(1);
}

await mkdir(outDir, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: '/usr/local/bin/google-chrome',
  headless: true,
  args: ['--no-sandbox', '--disable-gpu', `--user-data-dir=/tmp/pptr-audit-${process.pid}`],
});

async function auditViewport(page, label) {
  await page.evaluate(() =>
    document.querySelectorAll('.reveal').forEach((el) => el.classList.add('is-visible')),
  );

  const panels = await page.evaluate(() => {
    const rect = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.x), y: Math.round(r.y) };
    };
    const results = [];
    for (const panel of document.querySelectorAll('.gallery-item')) {
      const grid = panel.querySelector('[data-media-grid][data-mixed-panel]');
      if (!grid) continue;
      const stills = [
        ...grid.querySelectorAll('.gallery-still-open img, .gallery-image img, .gallery-image--hero-frame img'),
      ];
      const vids = [...grid.querySelectorAll('.gallery-video-thumb')];
      if (!stills.length || !vids.length) continue;

      const pairs = [...grid.querySelectorAll('[data-media-pair]')].map((pair) => {
        const still = pair.querySelector('.gallery-still-open img, .gallery-image img, .gallery-evil-eye-pair-still img');
        const vid = pair.querySelector('.gallery-video-thumb');
        const stillBox = rect(still);
        const vidBox = rect(vid);
        const caption = pair.querySelector('.gallery-evil-eye-caption');
        const fw = caption ? getComputedStyle(caption).fontWeight : null;
        return {
          stillBox,
          vidBox,
          stillLeftOfVideo: stillBox && vidBox ? stillBox.x + stillBox.w / 2 < vidBox.x + vidBox.w / 2 : null,
          sameRow:
            stillBox && vidBox ? Math.abs(stillBox.y - vidBox.y) < Math.min(stillBox.h, vidBox.h) * 0.55 : null,
          captionFontWeight: fw,
        };
      });

      const firstStill = stills[0];
      const firstVid = vids[0];
      const stillBox = rect(firstStill);
      const vidBox = rect(firstVid);
      const domStillsBeforeVideo = (() => {
        const children = [...grid.children];
        const stillIdx = children.findIndex((c) => c.querySelector?.('.gallery-image, .gallery-evil-eye-pair-still'));
        const vidIdx = children.findIndex((c) => c.querySelector?.('.gallery-video-thumb') || c.classList?.contains('gallery-video-thumb'));
        return stillIdx >= 0 && vidIdx >= 0 ? stillIdx < vidIdx : null;
      })();

      const children = [...grid.children].filter((c) => !c.classList.contains('gallery-more-media'));
      let domImagesBeforeAllVideos = true;
      let sawVideo = false;
      for (const child of children) {
        const isVid =
          child.classList.contains('gallery-video-thumb') || child.querySelector?.('.gallery-video-thumb');
        const isStill =
          child.classList.contains('gallery-image') || child.querySelector?.('.gallery-evil-eye-pair-still');
        if (isVid) sawVideo = true;
        if (isStill && sawVideo && !child.closest('[data-media-pair]')) {
          domImagesBeforeAllVideos = false;
          break;
        }
      }

      results.push({
        id: panel.id,
        title: panel.querySelector('.gallery-card-title')?.textContent?.trim(),
        stillCount: stills.length,
        videoCount: vids.length,
        firstStill: stillBox,
        firstVideo: vidBox,
        imageLeftOfVideo: stillBox && vidBox ? stillBox.x < vidBox.x : null,
        domImageBeforeVideo: domStillsBeforeVideo,
        domImagesBeforeAllVideos,
        pairs,
      });
    }
    return results;
  });

  const heroes = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const rect = (el) => {
      const r = el?.getBoundingClientRect();
      return r ? { w: Math.round(r.width), h: Math.round(r.height) } : null;
    };
    const waitImg = (img) =>
      new Promise((resolve) => {
        if (!img || (img.complete && img.naturalWidth)) return resolve();
        img?.addEventListener('load', () => resolve(), { once: true });
        img?.addEventListener('error', () => resolve(), { once: true });
        setTimeout(resolve, 800);
      });
    const ids = [
      'water-is-life-hidden-dangers-vr-campaign',
      'facebook-spaces',
      'google-play-music-panorama-festival-nyc-2016',
      'google-next-opening-keynote-2017',
      'evil-eye-pictures-san-francisco',
    ];
    const out = {};
    for (const id of ids) {
      const panel = document.getElementById(id);
      if (!panel) {
        out[id] = null;
        continue;
      }
      panel.scrollIntoView({ block: 'center', behavior: 'instant' });
      await sleep(350);
      const heroStill = panel.querySelector('.gallery-card-media--pair-hero .gallery-image--hero-frame img');
      const spotlight = panel.querySelector('.gallery-evil-eye-spotlight-band img, .gallery-evil-eye-spotlight img');
      const pearlImg = panel.querySelector('.gallery-evil-eye-pair--pearl .gallery-image img');
      const onIceImg = panel.querySelector('.gallery-evil-eye-pair--on-ice .gallery-image img');
      await waitImg(heroStill || pearlImg || spotlight);
      await waitImg(onIceImg);
      const captions = [...panel.querySelectorAll('.gallery-evil-eye-caption')].map((c) => ({
        text: c.textContent?.trim().slice(0, 40),
        fontWeight: getComputedStyle(c).fontWeight,
      }));
      out[id] = {
        heroStill: rect(heroStill),
        spotlightStill: rect(spotlight),
        pearlStill: rect(pearlImg),
        onIceStill: rect(onIceImg),
        pearlPairStill: rect(
          panel.querySelector('.gallery-evil-eye-pair--pearl .gallery-image--hero-frame'),
        ),
        onIcePairStill: rect(
          panel.querySelector('.gallery-evil-eye-pair--on-ice .gallery-image--hero-frame'),
        ),
        captions,
      };
    }
    return out;
  });

  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  }));

  return { label, panels, heroes, overflow };
}

const page = await browser.newPage();
if (baseUrl.includes('kagemushyabot.github.io')) {
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const url = req.url();
    if (
      req.isNavigationRequest() ||
      url.includes('kagemushyabot.github.io') ||
      url.startsWith('data:') ||
      url.includes('img.youtube.com')
    ) {
      req.continue();
      return;
    }
    if (['stylesheet', 'script', 'image', 'font'].includes(req.resourceType())) {
      req.continue();
      return;
    }
    req.continue();
  });
}

await page.setViewport({ width: 1440, height: 900 });
await page.goto(baseUrl, { waitUntil: 'load', timeout: 60000 });
await page.evaluate(() => document.querySelectorAll('.reveal').forEach((el) => el.classList.add('is-visible')));
await new Promise((r) => setTimeout(r, 1200));

const desktop = await auditViewport(page, 'desktop');

await page.setViewport({ width: 390, height: 844 });
await new Promise((r) => setTimeout(r, 400));
const mobile = await auditViewport(page, 'mobile');

await page.setViewport({ width: 1440, height: 900 });
await page.evaluate(() => {
  document.getElementById('facebook-spaces')?.scrollIntoView({ block: 'start' });
});
await new Promise((r) => setTimeout(r, 500));
await page.screenshot({
  path: path.join(outDir, 'work-exp-facebook-playmusic-desktop.png'),
  clip: await page.evaluate(() => {
    const fb = document.getElementById('facebook-spaces');
    const pano = document.getElementById('google-play-music-panorama-festival-nyc-2016');
    if (!fb) return { x: 0, y: 0, width: 1440, height: 400 };
    const r1 = fb.getBoundingClientRect();
    const r2 = pano?.getBoundingClientRect();
    const top = Math.min(r1.top, r2?.top ?? r1.top) - 16;
    const bottom = Math.max(r1.bottom, r2?.bottom ?? r1.bottom) + 16;
    return { x: 0, y: Math.max(0, top), width: 1440, height: Math.min(900, bottom - Math.max(0, top)) };
  }),
});

await page.evaluate(() =>
  document.getElementById('evil-eye-pictures-san-francisco')?.scrollIntoView({ block: 'start' }),
);
await new Promise((r) => setTimeout(r, 400));
await page.screenshot({ path: path.join(outDir, 'work-exp-evil-eye-desktop.png'), fullPage: false });

await page.setViewport({ width: 390, height: 844 });
await page.evaluate(() =>
  document.getElementById('evil-eye-pictures-san-francisco')?.scrollIntoView({ block: 'start' }),
);
await new Promise((r) => setTimeout(r, 400));
await page.screenshot({ path: path.join(outDir, 'work-exp-evil-eye-mobile.png'), fullPage: false });

const checklist = desktop.panels.map((p) => {
  const pairOk = p.pairs.length
    ? p.pairs.every((pair) => pair.stillLeftOfVideo && pair.sameRow)
    : p.stillCount === 1 && p.videoCount === 1
      ? p.imageLeftOfVideo
      : p.domImagesBeforeAllVideos;
  return {
    id: p.id,
    title: p.title,
    pass: Boolean(pairOk),
    imageLeftOfVideo: p.imageLeftOfVideo,
    domImageBeforeVideo: p.domImageBeforeVideo,
    domImagesBeforeAllVideos: p.domImagesBeforeAllVideos,
    pairs: p.pairs,
  };
});

const report = {
  baseUrl,
  desktop,
  mobile,
  checklist,
  allMixedPass: checklist.every((c) => c.pass),
};

await writeFile(path.join(outDir, 'work-exp-layout-metrics.json'), JSON.stringify(report, null, 2));
await browser.close();

console.log(JSON.stringify({ allMixedPass: report.allMixedPass, checklist, heroes: desktop.heroes }, null, 2));
process.exit(report.allMixedPass ? 0 : 1);
