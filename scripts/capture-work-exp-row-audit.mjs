import puppeteer from 'puppeteer-core';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { buildPortfolioGallery } from '../src/utils/portfolioGallery.ts';

const outDir = process.argv[2];
const baseUrl =
  process.argv[3] ?? 'https://kagemushyabot.github.io/projects/work-experience/?v=' + Date.now();

if (!outDir) {
  console.error('usage: node scripts/capture-work-exp-row-audit.mjs <outDir> [baseUrl]');
  process.exit(1);
}

await mkdir(outDir, { recursive: true });

const { layoutReport } = buildPortfolioGallery();
const EXPECTED_TAIL = layoutReport.tailAfterInsightIds;
const EXPECTED_FROM_MISSION = layoutReport.idsFromMission;

const browser = await puppeteer.launch({
  executablePath: '/usr/local/bin/google-chrome',
  headless: true,
  args: ['--no-sandbox', '--disable-gpu', `--user-data-dir=/tmp/pptr-row-${process.pid}`],
});

const page = await browser.newPage();
const TOP_TOLERANCE_PX = 12;
const HERO_W_TARGET = 345;
const HERO_H_TARGET = 215;
const HERO_TOLERANCE = 12;

async function gotoGallery() {
  await page.goto(baseUrl, { waitUntil: 'networkidle2', timeout: 90000 });
  await page.evaluate(() => document.querySelectorAll('.reveal').forEach((el) => el.classList.add('is-visible')));
  await page.evaluate(() => document.getElementById('work-main')?.scrollIntoView({ block: 'start', behavior: 'instant' }));
  await new Promise((r) => setTimeout(r, 350));
}

async function scrollPanelsForCapture(ids) {
  if (!ids.length) return;
  const landed = await page.evaluate((panelIds) => {
    const el = document.getElementById(panelIds[0]);
    if (!el) return { ok: false, top: null };
    const y = el.getBoundingClientRect().top + window.scrollY - 32;
    window.scrollTo({ top: Math.max(0, y), left: 0, behavior: 'instant' });
    const top = el.getBoundingClientRect().top;
    return { ok: top >= 0 && top < 160, top: Math.round(top) };
  }, ids);
  if (!landed.ok) {
    await page.evaluate((id) => {
      document.getElementById(id)?.scrollIntoView({ block: 'start', behavior: 'instant' });
    }, ids[0]);
  }
  for (const id of ids) {
    await scrollPanelDecode(id);
  }
  const top = await page.evaluate((id) => {
    const el = document.getElementById(id);
    return el ? Math.round(el.getBoundingClientRect().top) : null;
  }, ids[0]);
  return top;
}

async function scrollPanelDecode(id) {
  await page.evaluate(async (panelId) => {
    const panel = document.getElementById(panelId);
    if (!panel) return;
    const imgs = [...panel.querySelectorAll('img')];
    await Promise.all(
      imgs.map(
        (img) =>
          new Promise((resolve) => {
            if (img.complete && img.naturalWidth) {
              img.decode?.().then(resolve).catch(resolve);
            } else {
              img.addEventListener('load', () => resolve(), { once: true });
              img.addEventListener('error', () => resolve(), { once: true });
              setTimeout(resolve, 1500);
            }
          }),
      ),
    );
  }, id);
  await new Promise((r) => setTimeout(r, 400));
}

async function clipForIds(ids) {
  return page.evaluate((panelIds) => {
    const rects = panelIds
      .map((id) => {
        const el = document.getElementById(id);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { id, top: r.top, bottom: r.bottom };
      })
      .filter(Boolean);
    if (!rects.length) return { x: 0, y: 200, width: 1440, height: 400 };
    const anchor = rects[0];
    const top = Math.max(0, Math.round(Math.min(anchor.top, ...rects.map((r) => r.top)) - 12));
    const bottom = Math.max(...rects.map((r) => r.bottom)) + 16;
    const height = Math.min(900 - top, Math.round(bottom - top));
    return {
      x: 0,
      y: top,
      width: 1440,
      height: Math.max(120, Math.min(900, height)),
    };
  }, ids);
}

async function measurePanel(id) {
  return page.evaluate((panelId) => {
    const el = document.getElementById(panelId);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return {
      id: panelId,
      top: Math.round(r.top),
      left: Math.round(r.left),
      width: Math.round(r.width),
      height: Math.round(r.height),
      solo: el.classList.contains('gallery-item--solo-row'),
      rowHalf: el.classList.contains('gallery-item--row-half'),
    };
  }, id);
}

async function measureStills(id) {
  return page.evaluate((panelId) => {
    const panel = document.getElementById(panelId);
    if (!panel) return [];
    return [...panel.querySelectorAll('.gallery-still-open img, .gallery-image img')].map((img) => {
      const r = img.getBoundingClientRect();
      return {
        w: Math.round(r.width),
        h: Math.round(r.height),
        naturalW: img.naturalWidth,
        naturalH: img.naturalHeight,
        visible: r.width > 8 && r.height > 8,
      };
    });
  }, id);
}

await page.setViewport({ width: 1440, height: 900 });
await gotoGallery();

await scrollPanelsForCapture(['water-is-life-hidden-dangers-vr-campaign']);
const refWater = await measureStills('water-is-life-hidden-dangers-vr-campaign');
await scrollPanelsForCapture(['mission-to-the-deep-exhibit']);
const missionStills = await measureStills('mission-to-the-deep-exhibit');

const rowChecks = [];
for (const [leftId, rightId] of [
  ['blood-brothers-2-mobile-game', 'transformer-age-of-extinction-mobile-game'],
  ['prototype-music-game', 'prototype-ar-car-chase-app'],
  ['character-animation-for-escape-plan-ps-vita', 'ux-previsualization'],
]) {
  const left = await measurePanel(leftId);
  const right = await measurePanel(rightId);
  const topDelta = left && right ? Math.abs(left.top - right.top) : null;
  rowChecks.push({
    pair: [leftId, rightId],
    left,
    right,
    sameRowTop: topDelta !== null ? topDelta <= TOP_TOLERANCE_PX : false,
    topDelta,
  });
}

const domOrder = await page.evaluate(() => {
  const main = document.getElementById('work-main');
  return [...(main?.querySelectorAll('.gallery-item') ?? [])].map((el) => el.id);
});

const missionIdx = domOrder.indexOf('mission-to-the-deep-exhibit');
const domFromMission = missionIdx >= 0 ? domOrder.slice(missionIdx) : [];
const insightIdx = domOrder.indexOf('insight-digital-emeryville');
const domTail = insightIdx >= 0 ? domOrder.slice(insightIdx + 1) : [];

const orderMatch =
  JSON.stringify(domFromMission) === JSON.stringify(EXPECTED_FROM_MISSION) &&
  JSON.stringify(domTail) === JSON.stringify(EXPECTED_TAIL);

const waterRef = refWater.find((s) => s.visible) ?? refWater[0];
const missionPass =
  missionStills.length > 0 &&
  missionStills.every(
    (s) =>
      s.visible &&
      Math.abs(s.w - (waterRef?.w ?? HERO_W_TARGET)) <= HERO_TOLERANCE + 40 &&
      Math.abs(s.h - (waterRef?.h ?? HERO_H_TARGET)) <= HERO_TOLERANCE,
  );

async function screenshotPanelRow(ids, filename) {
  await scrollPanelsForCapture(ids);
  await new Promise((r) => setTimeout(r, 250));
  const boxes = [];
  for (const id of ids) {
    const handle = await page.$(`#${id}`);
    const box = handle ? await handle.boundingBox() : null;
    if (!box || box.height < 40) {
      throw new Error(`Panel #${id} not visible for screenshot (box=${JSON.stringify(box)})`);
    }
    boxes.push({ id, ...box });
  }
  const top = Math.max(0, Math.floor(Math.min(...boxes.map((b) => b.y)) - 14));
  const bottom = Math.ceil(Math.max(...boxes.map((b) => b.y + b.height)) + 14);
  if (top > 220) {
    throw new Error(`Panels still below fold for ${filename} (top=${top}, ids=${ids.join(',')})`);
  }
  const height = Math.min(900 - top, Math.max(140, bottom - top));
  const titles = await page.evaluate((panelIds) => {
    return panelIds.map((id) => document.getElementById(id)?.querySelector('.gallery-card-title')?.textContent?.trim());
  }, ids);
  const scrollY = await page.evaluate(() => window.scrollY);
  await page.screenshot({
    path: path.join(outDir, filename),
    clip: { x: 0, y: top, width: 1440, height },
  });
  return {
    top,
    height,
    scrollY,
    titles,
    boxes: boxes.map(({ id, x, y, width, height: h }) => ({ id, x, y, width, h })),
  };
}

const shotMissionMarvel = ['mission-to-the-deep-exhibit', 'marvel-mighty-heroes-mobile-game'];
const screenshotMeta = {};
screenshotMeta.missionMarvel = await screenshotPanelRow(shotMissionMarvel, 'work-exp-row-mission-marvel.png');
screenshotMeta.bloodTransformer = await screenshotPanelRow(
  ['blood-brothers-2-mobile-game', 'transformer-age-of-extinction-mobile-game'],
  'work-exp-row-blood-transformer.png',
);
screenshotMeta.floatPrototype = await screenshotPanelRow(
  ['floathybrid-entertainment-sf', 'prototype-music-game', 'prototype-ar-car-chase-app'],
  'work-exp-row-float-prototype.png',
);
screenshotMeta.escapeInsight = await screenshotPanelRow(
  ['character-animation-for-escape-plan-ps-vita', 'ux-previsualization', 'insight-digital-emeryville'],
  'work-exp-row-escape-insight.png',
);

await page.setViewport({ width: 390, height: 844 });
await gotoGallery();
await page.evaluate(() => document.getElementById('work-main')?.scrollIntoView({ block: 'start', behavior: 'instant' }));
screenshotMeta.mobileMissionMarvel = await screenshotPanelRow(
  shotMissionMarvel,
  'work-exp-gallery-mobile-rows.png',
);
const overflow = await page.evaluate(() => ({
  overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  scrollWidth: document.documentElement.scrollWidth,
  clientWidth: document.documentElement.clientWidth,
}));
const audit = {
  baseUrl,
  capturedAt: new Date().toISOString(),
  expectedFromMission: EXPECTED_FROM_MISSION,
  domFromMission,
  expectedTailAfterInsight: EXPECTED_TAIL,
  domTailAfterInsight: domTail,
  orderMatch,
  rowPairChecks: rowChecks,
  allPairsSameRowTop: rowChecks.every((c) => c.sameRowTop),
  missionStills,
  waterRefStill: waterRef,
  missionHeroFramesPass: missionPass,
  mobileOverflow: overflow,
  screenshotMeta,
  pass:
    orderMatch &&
    rowChecks.every((c) => c.sameRowTop) &&
    missionPass &&
    !overflow.overflowX &&
    screenshotMeta.missionMarvel?.titles?.[0]?.toLowerCase().includes('mission'),
};

await writeFile(path.join(outDir, 'work-exp-row-audit.json'), JSON.stringify(audit, null, 2));
await browser.close();

console.log(JSON.stringify({ pass: audit.pass, audit }, null, 2));
process.exit(audit.pass ? 0 : 1);
