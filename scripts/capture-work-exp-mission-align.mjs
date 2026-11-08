import puppeteer from 'puppeteer-core';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const outDir = process.argv[2];
const baseUrl = process.argv[3];
const sha = process.argv[4] || 'local';

const MISSION_ID = 'mission-to-the-deep-exhibit';
const REF_ID = process.argv[5] || 'marvel-mighty-heroes-mobile-game';

if (!outDir || !baseUrl) {
  console.error(
    'usage: npx vite-node scripts/capture-work-exp-mission-align.mjs <outDir> <workExpUrl> [sha] [refPanelId]',
  );
  process.exit(1);
}

await mkdir(outDir, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: '/usr/local/bin/google-chrome',
  headless: true,
  args: ['--no-sandbox', '--disable-gpu', `--user-data-dir=/tmp/pptr-mission-align-${process.pid}`],
});

const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });

await page.goto(baseUrl, { waitUntil: 'networkidle2', timeout: 90000 });
await page.evaluate(() => document.querySelectorAll('.reveal').forEach((el) => el.classList.add('is-visible')));

async function measureAlign(panelId) {
  return page.evaluate((id) => {
    const panel = document.getElementById(id);
    if (!panel) return null;
    const card = panel.querySelector('.gallery-card');
    const still =
      panel.querySelector('.gallery-still-open') ||
      panel.querySelector('.gallery-video-thumb') ||
      panel.querySelector('.gallery-image--hero-frame');
    const title = panel.querySelector('.gallery-card-title')?.textContent?.trim();
    const pr = panel.getBoundingClientRect();
    const cr = card?.getBoundingClientRect();
    const sr = still?.getBoundingClientRect();
    const gridColumn = getComputedStyle(panel).gridColumn;
    return {
      id,
      title,
      gridColumn,
      panelLeft: Math.round(pr.left),
      cardLeft: card ? Math.round(cr.left) : null,
      mediaLeft: still ? Math.round(sr.left) : null,
    };
  }, panelId);
}

async function scrollMissionRef() {
  await page.evaluate((missionId) => {
    const el = document.getElementById(missionId);
    if (!el) return;
    const y = el.getBoundingClientRect().top + window.scrollY - 28;
    window.scrollTo({ top: Math.max(0, y), left: 0, behavior: 'instant' });
  }, MISSION_ID);
  await page.evaluate(async (ids) => {
    for (const id of ids) {
      const panel = document.getElementById(id);
      const imgs = [...(panel?.querySelectorAll('img') ?? [])];
      await Promise.all(
        imgs.map(
          (img) =>
            new Promise((resolve) => {
              if (img.complete && img.naturalWidth) return img.decode?.().then(resolve).catch(resolve) ?? resolve();
              img.addEventListener('load', () => resolve(), { once: true });
              setTimeout(resolve, 1800);
            }),
        ),
      );
    }
  }, [MISSION_ID, REF_ID]);
  await new Promise((r) => setTimeout(r, 400));
}

await scrollMissionRef();

const mission = await measureAlign(MISSION_ID);
const ref = await measureAlign(REF_ID);

async function screenshotMissionRefRegion() {
  const boxes = await page.evaluate((ids) => {
    return ids.map((id) => {
      const el = document.getElementById(id);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const title = el.querySelector('.gallery-card-title')?.textContent?.trim() ?? '';
      return {
        id,
        title,
        x: r.x,
        y: r.y,
        width: r.width,
        height: r.height,
      };
    });
  }, [MISSION_ID, REF_ID]);

  const valid = boxes.filter(Boolean);
  if (valid.length < 2) throw new Error('missing mission or reference panel for screenshot');

  const top = Math.max(0, Math.floor(Math.min(...valid.map((b) => b.y)) - 10));
  const bottom = Math.ceil(Math.max(...valid.map((b) => b.y + b.height)) + 12);
  const height = Math.min(900 - top, Math.max(180, bottom - top));
  const firstTop = valid[0].y;
  if (firstTop > 200) {
    throw new Error(`Mission/ref not in expected viewport band (firstTop=${firstTop})`);
  }

  const shotPath = path.join(outDir, 'work-exp-mission-left-align-desktop.png');
  await page.screenshot({
    path: shotPath,
    clip: { x: 0, y: top, width: 1440, height },
  });

  return { clip: { x: 0, y: top, width: 1440, height }, panels: valid };
}

const screenshot = await screenshotMissionRefRegion();

const leftTolerance = 2;
const panelDelta = mission && ref ? Math.abs(mission.panelLeft - ref.panelLeft) : 999;
const cardDelta = mission && ref && mission.cardLeft != null && ref.cardLeft != null ? Math.abs(mission.cardLeft - ref.cardLeft) : 999;
const mediaDelta =
  mission && ref && mission.mediaLeft != null && ref.mediaLeft != null ? Math.abs(mission.mediaLeft - ref.mediaLeft) : 999;

const missionStills = await page.evaluate((id) => {
  return [...(document.getElementById(id)?.querySelectorAll('.gallery-still-open img') ?? [])].map((img) => {
    const r = img.getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height) };
  });
}, MISSION_ID);

const stillSizePass =
  missionStills.length >= 3 &&
  missionStills.every((s) => Math.abs(s.w - 345) <= 12 && Math.abs(s.h - 215) <= 12);

const metrics = {
  baseUrl,
  deploySha: sha,
  capturedAt: new Date().toISOString(),
  referencePanelId: REF_ID,
  mission,
  reference: ref,
  deltasPx: {
    panelOuterLeft: panelDelta,
    cardInnerLeft: cardDelta,
    firstMediaLeft: mediaDelta,
  },
  missionStillSizes: missionStills,
  screenshot,
  selfCheck: {
    panelLeftWithin2px: panelDelta <= leftTolerance,
    cardLeftWithin2px: cardDelta <= leftTolerance,
    mediaLeftWithin2px: mediaDelta <= leftTolerance,
    missionGridFullWidth: mission?.gridColumn === '1 / -1' || mission?.gridColumn?.startsWith('1'),
    still345x215: stillSizePass,
    titlesInShot:
      screenshot.panels.every((p) => p.title?.length) &&
      screenshot.panels.some((p) => p.id === MISSION_ID && p.title.toLowerCase().includes('mission')),
    pass:
      panelDelta <= leftTolerance &&
      cardDelta <= leftTolerance &&
      mediaDelta <= leftTolerance &&
      stillSizePass &&
      screenshot.panels.length >= 2,
  },
};

await writeFile(path.join(outDir, 'work-exp-mission-align-metrics.json'), JSON.stringify(metrics, null, 2));
await browser.close();

console.log(JSON.stringify(metrics, null, 2));
process.exit(metrics.selfCheck.pass ? 0 : 1);
