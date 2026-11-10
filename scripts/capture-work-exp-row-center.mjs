import puppeteer from 'puppeteer-core';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { buildPortfolioGallery, buildGalleryRowGroups } from '../src/utils/portfolioGallery.ts';

const outDir = process.argv[2];
const baseUrl = process.argv[3];
const sha = process.argv[4] || 'local';

if (!outDir || !baseUrl) {
  console.error(
    'usage: npx vite-node scripts/capture-work-exp-row-center.mjs <outDir> <workExpUrl> [sha]',
  );
  process.exit(1);
}

const MISSION_ID = 'mission-to-the-deep-exhibit';
const MARVEL_ID = 'marvel-mighty-heroes-mobile-game';
const BLOOD_ID = 'blood-brothers-2-mobile-game';
const TRANSFORMER_ID = 'transformer-age-of-extinction-mobile-game';
const PREPRODUCTION_ID = 'preproduction-of-the-opening-ceremony-projection';
const EVIL_EYE_ID = 'evil-eye-pictures-san-francisco';

const { layoutReport } = buildPortfolioGallery();

await mkdir(outDir, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: '/usr/local/bin/google-chrome',
  headless: true,
  args: ['--no-sandbox', '--disable-gpu', `--user-data-dir=/tmp/pptr-row-center-${process.pid}`],
});

async function preparePage(page, viewport) {
  await page.setViewport(viewport);
  await page.goto(baseUrl, { waitUntil: 'networkidle2', timeout: 90000 });
  await page.evaluate(() => document.querySelectorAll('.reveal').forEach((el) => el.classList.add('is-visible')));
  await page.evaluate(async () => {
    const panels = [...document.querySelectorAll('.gallery-item[id]')];
    for (const panel of panels) {
      const imgs = [...panel.querySelectorAll('img')];
      await Promise.all(
        imgs.map(
          (img) =>
            new Promise((resolve) => {
              if (img.complete && img.naturalWidth) img.decode?.().then(resolve).catch(resolve) ?? resolve();
              else {
                img.addEventListener('load', () => resolve(), { once: true });
                img.addEventListener('error', () => resolve(), { once: true });
                setTimeout(resolve, 1600);
              }
            }),
        ),
      );
    }
  });
  await new Promise((r) => setTimeout(r, 500));
}

const page = await browser.newPage();
await preparePage(page, { width: 1440, height: 900, deviceScaleFactor: 1 });

const rowGroups = buildGalleryRowGroups(buildPortfolioGallery().projects);

const rowMetrics = await page.evaluate(
  ({ expectedFromMission, rowGroupIds }) => {
  const main = document.querySelector('main');
  const grid = document.querySelector('.gallery-grid');
  if (!main || !grid) return { error: 'missing main or gallery-grid' };

  const containerRect = main.getBoundingClientRect();
  const containerCenterX = containerRect.left + containerRect.width / 2;

  const missionIdx = rowGroupIds.findIndex((ids) => ids.includes('mission-to-the-deep-exhibit'));
  const scopedGroups = missionIdx >= 0 ? rowGroupIds.slice(missionIdx) : rowGroupIds;

  const rows = [];
  for (const ids of scopedGroups) {
    const group = ids.map((id) => document.getElementById(id)).filter(Boolean);
    if (!group.length) continue;
    const rects = group.map((node) => node.getBoundingClientRect());
    const left = Math.min(...rects.map((r) => r.left));
    const right = Math.max(...rects.map((r) => r.right));
    const top = Math.min(...rects.map((r) => r.top));
    const bottom = Math.max(...rects.map((r) => r.bottom));
    const rowCenterX = (left + right) / 2;
    const deltaX = Math.round((rowCenterX - containerCenterX) * 10) / 10;

    const internal = group.map((node) => {
      const pr = node.getBoundingClientRect();
      const media =
        node.querySelector('.gallery-card-media') ||
        node.querySelector('.gallery-still-open') ||
        node.querySelector('.gallery-image--hero-frame');
      const mr = media?.getBoundingClientRect();
      return {
        id: node.id,
        mediaOffsetFromPanelLeft: mr ? Math.round(mr.left - pr.left) : null,
        panelWidth: Math.round(pr.width),
      };
    });

    rows.push({
      ids: group.map((n) => n.id),
      kind: group.length > 1 ? 'group' : 'solo',
      rowCenterX: Math.round(rowCenterX * 10) / 10,
      containerCenterX: Math.round(containerCenterX * 10) / 10,
      deltaX,
      bbox: {
        left: Math.round(left),
        right: Math.round(right),
        top: Math.round(top),
        bottom: Math.round(bottom),
        width: Math.round(right - left),
      },
      internal,
    });
  }

  const maxDeltaX = rows.reduce((m, r) => Math.max(m, Math.abs(r.deltaX)), 0);
  const expectedIds = expectedFromMission.flatMap((entry) => (Array.isArray(entry) ? [...entry] : [entry]));
  const observedIds = rows.flatMap((r) => r.ids);
  const orderOk =
    expectedIds.length === observedIds.length &&
    expectedIds.every((id, idx) => id === observedIds[idx]);

  return {
    viewportWidth: window.innerWidth,
    container: {
      left: Math.round(containerRect.left),
      width: Math.round(containerRect.width),
      centerX: Math.round(containerCenterX * 10) / 10,
    },
    rowCount: rows.length,
    maxDeltaX: Math.round(maxDeltaX * 10) / 10,
    orderOk,
    rows,
  };
  },
  {
    expectedFromMission: layoutReport.idsFromMission,
    rowGroupIds: rowGroups,
  },
);

const sampleInternal = await page.evaluate((ids) => {
  return Object.fromEntries(
    ids.map((id) => {
      const panel = document.getElementById(id);
      if (!panel) return [id, null];
      const pr = panel.getBoundingClientRect();
      const media = panel.querySelector('.gallery-card-media');
      const mr = media?.getBoundingClientRect();
      const still = panel.querySelector('.gallery-still-open, .gallery-image--hero-frame, .gallery-video-thumb');
      const sr = still?.getBoundingClientRect();
      return [
        id,
        {
          gridColumn: getComputedStyle(panel).gridColumn,
          mediaOffsetFromPanelLeft: mr ? Math.round(mr.left - pr.left) : null,
          stillOffsetFromPanelLeft: sr ? Math.round(sr.left - pr.left) : null,
          panelWidth: Math.round(pr.width),
        },
      ];
    }),
  );
}, [MISSION_ID, BLOOD_ID, TRANSFORMER_ID, PREPRODUCTION_ID, EVIL_EYE_ID]);

async function scrollToIds(ids) {
  await page.evaluate((panelIds) => {
    document.getElementById(panelIds[0])?.scrollIntoView({ block: 'center', behavior: 'instant' });
  }, ids);
  await new Promise((r) => setTimeout(r, 450));
}

async function elementShot(file, id) {
  const el = await page.$(`#${id}`);
  if (!el) return;
  await el.screenshot({ path: path.join(outDir, file) });
  await el.dispose();
}

async function rowClipShot(file, ids) {
  const clip = await page.evaluate((panelIds) => {
    const rects = panelIds
      .map((pid) => document.getElementById(pid)?.getBoundingClientRect())
      .filter(Boolean);
    if (!rects.length) return null;
    const top = Math.max(0, Math.min(...rects.map((r) => r.top)) - 16);
    const bottom = Math.max(...rects.map((r) => r.bottom)) + 20;
    return {
      x: 0,
      y: Math.round(top),
      width: 1440,
      height: Math.min(900, Math.round(bottom - top)),
    };
  }, ids);
  if (!clip) return;
  await page.screenshot({ path: path.join(outDir, file), clip });
}

await scrollToIds([MISSION_ID]);
await elementShot('work-exp-row-center-mission-inspect.png', MISSION_ID);
await rowClipShot('work-exp-row-center-mission-row.png', [MISSION_ID]);

await scrollToIds([BLOOD_ID, TRANSFORMER_ID]);
await elementShot('work-exp-row-center-pair-blood-inspect.png', BLOOD_ID);
await elementShot('work-exp-row-center-pair-transformer-inspect.png', TRANSFORMER_ID);
await rowClipShot('work-exp-row-center-pair-row.png', [BLOOD_ID, TRANSFORMER_ID]);

await scrollToIds([PREPRODUCTION_ID]);
await elementShot('work-exp-row-center-preproduction-inspect.png', PREPRODUCTION_ID);
await rowClipShot('work-exp-row-center-preproduction-row.png', [PREPRODUCTION_ID]);

await scrollToIds([EVIL_EYE_ID]);
await elementShot('work-exp-row-center-evil-eye-inspect.png', EVIL_EYE_ID);
await rowClipShot('work-exp-row-center-evil-eye-row.png', [EVIL_EYE_ID]);

await scrollToIds([MARVEL_ID]);
await elementShot('work-exp-row-center-marvel-inspect.png', MARVEL_ID);

const mobilePage = await browser.newPage();
await preparePage(mobilePage, { width: 390, height: 844, deviceScaleFactor: 2 });
const mobileOverflow = await mobilePage.evaluate(() => {
  const doc = document.documentElement;
  return {
    clientWidth: doc.clientWidth,
    scrollWidth: doc.scrollWidth,
    overflowX: doc.scrollWidth > doc.clientWidth + 1,
  };
});
await mobilePage.close();

const payload = {
  sha,
  baseUrl,
  capturedAt: new Date().toISOString(),
  desktop: {
    ...rowMetrics,
    sampleInternal,
    passMaxDelta: rowMetrics.maxDeltaX <= 48,
  },
  mobile: mobileOverflow,
  mobilePass: !mobileOverflow.overflowX,
};

await writeFile(path.join(outDir, 'work-exp-row-center-metrics.json'), JSON.stringify(payload, null, 2));

await browser.close();
console.log(JSON.stringify({ ok: true, maxDeltaX: payload.desktop.maxDeltaX, mobilePass: payload.mobilePass }));
