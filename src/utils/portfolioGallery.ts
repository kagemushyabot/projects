import presentation from '../content/presentation.html?raw';
import images from '../content/images.html?raw';
import movies from '../content/movies.html?raw';

export type PortfolioSource = 'presentation' | 'images' | 'movies';

export interface GalleryImage {
  src: string;
  alt: string;
}

export interface GalleryVideo {
  youtubeId: string;
  label?: string;
}

export interface GalleryStillWithCaption {
  src: string;
  alt: string;
  captionText: string;
}

export interface GalleryMediaPair {
  still: GalleryStillWithCaption;
  youtubeId: string;
  videoAlt: string;
}

export interface EvilEyeStructuredLayout {
  spotlight: { src: string; alt: string };
  pearl: GalleryMediaPair;
  onIce: GalleryMediaPair;
}

export interface GalleryProject {
  id: string;
  title: string;
  credit?: string;
  notes: string[];
  images: GalleryImage[];
  videos: GalleryVideo[];
  sources: PortfolioSource[];
  layout: 'compact' | 'wide' | 'tall' | 'feature';
  mergedFrom: string[];
  evilEyeLayout?: EvilEyeStructuredLayout;
}

export const EVIL_EYE_PANEL_ID = 'evil-eye-pictures-san-francisco';
export const WATER_PANEL_ID = 'water-is-life-hidden-dangers-vr-campaign';

/** Single still + single video — hero frame aligned to Water (desktop ~345×215). */
export const PAIR_HERO_FEATURE_IDS = new Set([
  'facebook-spaces',
  'google-play-music-panorama-festival-nyc-2016',
  'google-next-opening-keynote-2017',
  WATER_PANEL_ID,
]);

export const MISSION_PANEL_ID = 'mission-to-the-deep-exhibit';
export const INSIGHT_PANEL_ID = 'insight-digital-emeryville';

/** Full-width gallery rows (desktop). */
export const SOLO_ROW_PANEL_IDS = [
  MISSION_PANEL_ID,
  'marvel-mighty-heroes-mobile-game',
  'floathybrid-entertainment-sf',
  INSIGHT_PANEL_ID,
] as const;

/** Left/right pairs on one desktop row (DOM order = left then right). */
export const GALLERY_ROW_PAIRS: readonly (readonly [string, string])[] = [
  ['blood-brothers-2-mobile-game', 'transformer-age-of-extinction-mobile-game'],
  ['prototype-music-game', 'prototype-ar-car-chase-app'],
  ['character-animation-for-escape-plan-ps-vita', 'ux-previsualization'],
] as const;

export const GALLERY_ROW_PAIR_IDS = new Set(GALLERY_ROW_PAIRS.flat());

/**
 * Ordered gallery block starting at Mission; tail after Insight preserved from pre-curate order.
 * Tuple = pair on one row; string = solo row.
 */
export const GALLERY_ROW_SEQUENCE_FROM_MISSION: readonly (string | readonly [string, string])[] = [
  MISSION_PANEL_ID,
  'marvel-mighty-heroes-mobile-game',
  GALLERY_ROW_PAIRS[0],
  'floathybrid-entertainment-sf',
  GALLERY_ROW_PAIRS[1],
  GALLERY_ROW_PAIRS[2],
  INSIGHT_PANEL_ID,
];

const MYVR_TITLE_RE = /\bmy\s*vr\s*app\b/i;
const MARVEL_PANEL_ID = 'marvel-mighty-heroes-mobile-game';
export const MARVEL_YOUTUBE_ID = 'DjZyFg5CHIs';

export const EVIL_EYE_PEARL_CAPTION =
  'Directed by Patrick Osborne. A father and daughter travel the country in their hatchback, chasing their dreams — Google Spotlight Stories’ “Pearl” for 360°, VR, and theatrical release. Academy Award nominee, Best Animated Short Film (2017).';

export const EVIL_EYE_ON_ICE_CAPTION =
  'Directed by Shannon Tindle. A Google Spotlight Stories VR short about an extravagant ice show and its star performer interrupted by an unlikely interloper. Annie Award nominee, Best Animated Short Subject (43rd Annie Awards, 2016).';

export const EVIL_EYE_COPY_SOURCES = {
  pearl: [
    'https://blog.google/products-and-platforms/products/atap/making-pearl/',
    'https://evileyepictures.com/work/pearl/',
  ],
  onIce: [
    'https://variety.com/2016/digital/news/google-spotlight-stories-virtual-reality-on-ice-1201699131/',
    'https://evileyepictures.com/work/on-ice/',
  ],
} as const;

export interface DedupeReportEntry {
  canonicalId: string;
  title: string;
  mergedKeys: string[];
  sources: PortfolioSource[];
}

/** Parse raw WP HTML; asset paths stay `/assets/...` until render (`assetUrl`). */
const SOURCES: { source: PortfolioSource; html: string; stripHero: boolean }[] = [
  { source: 'presentation', html: presentation, stripHero: true },
  { source: 'images', html: images, stripHero: false },
  { source: 'movies', html: movies, stripHero: false },
];

/** WordPress-era nav / decorative link icons — not project media. */
const LEGACY_NAV_ICON_FILES = new Set([
  'anim_icon.png',
  'misc_icon.png',
  'resume_icon1.png',
  'still_icon2.png',
  'dropbox-icon.png',
]);

const LAYOUT_CYCLE: GalleryProject['layout'][] = [
  'compact',
  'wide',
  'compact',
  'tall',
  'feature',
  'compact',
  'wide',
  'compact',
  'tall',
  'compact',
];

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/&amp;/g, '&')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function slugify(title: string, index: number): string {
  const base =
    normalizeTitle(title)
      .slice(0, 48)
      .replace(/\s+/g, '-')
      .replace(/^-+|-+$/g, '') || `project-${index}`;
  return base;
}

function isObsoleteNavChunk(html: string): boolean {
  const imgBasenames = [
    ...html.matchAll(/\/assets\/wp-import\/([^"'?#\s]+)/gi),
    ...html.matchAll(/wp-import\/([^"'?#\s]+)/gi),
  ].map((m) => m[1].split('?')[0]);
  if (!imgBasenames.length) return false;
  const onlyLegacy = imgBasenames.every((b) => LEGACY_NAV_ICON_FILES.has(b));
  if (onlyLegacy) return true;
  const hasLegacyNavLink =
    /junnagaoka\.wordpress\.com\/(movies|images|miscellaneous|test)\//i.test(html) &&
    imgBasenames.some((b) => LEGACY_NAV_ICON_FILES.has(b));
  return hasLegacyNavLink;
}

const SPOTLIGHT_COMPOUND_IMAGES = ['image1.jpeg', 'image3.jpeg', 'image4.jpeg'] as const;

function imageBasename(src: string): string {
  return (src.split('/').pop() || src).split('?')[0];
}

function extractParagraphContaining(html: string, needle: string): string {
  const idx = html.indexOf(needle);
  if (idx === -1) return '';
  const start = html.lastIndexOf('<p', idx);
  const end = html.indexOf('</p>', idx);
  if (start === -1 || end === -1) return '';
  return html.slice(start, end + 4);
}

function extractYoutubeParagraph(html: string, youtubeId: string): string {
  const marker = `embed/${youtubeId}`;
  const idx = html.indexOf(marker);
  if (idx === -1) return '';
  const start = html.lastIndexOf('<p', idx);
  const end = html.indexOf('</p>', idx);
  if (start === -1 || end === -1) return '';
  return html.slice(start, end + 4);
}

/** `movies.html` opens with a single chunk bundling Spotlight + PEARL + ON ICE without h3 titles. */
function expandSpotlightMoviesChunk(chunk: string): string[] {
  const basenames = new Set(
    [...chunk.matchAll(/\/assets\/wp-import\/([^"'?#\s]+)/gi)].map((m) => m[1].split('?')[0]),
  );
  const isCompound = SPOTLIGHT_COMPOUND_IMAGES.every((name) => basenames.has(name));
  if (!isCompound || /<h3[^>]*>[\s\S]*PEARL/i.test(chunk)) {
    return [chunk];
  }

  const creditBlock = chunk.match(/<h4[\s\S]*?evileyepictures\.com[\s\S]*?<\/h4>/i)?.[0];

  const spotlight = [
    '<h3 style="text-align:center;">Google Spotlight Stories</h3>',
    extractParagraphContaining(chunk, 'image1.jpeg'),
    extractParagraphContaining(chunk, '<strong>Worked as TD generalist</strong>'),
  ]
    .filter(Boolean)
    .join('\n');

  const pearl = [
    '<h3 style="text-align:center;"><span style="color:#ffcc00;">PEARL</span></h3>',
    extractParagraphContaining(chunk, 'image3.jpeg'),
    extractYoutubeParagraph(chunk, 'JrkslAhyOVc'),
    '<p style="text-align:center;"><strong>Worked as TD generalist</strong></p>',
  ]
    .filter(Boolean)
    .join('\n');

  const onIce = [
    '<h3 style="text-align:center;"><span style="color:#ffcc00;"><strong>ON ICE</strong></span></h3>',
    extractParagraphContaining(chunk, 'image4.jpeg'),
    extractYoutubeParagraph(chunk, '0cYI8AXkC2I'),
    creditBlock ?? '',
  ]
    .filter(Boolean)
    .join('\n');

  return [spotlight, pearl, onIce].map((c) => c.trim()).filter((c) => c.length > 40);
}

function splitChunks(html: string, stripHero: boolean): string[] {
  let cleaned = html.trim();
  if (stripHero) {
    cleaned = cleaned.replace(
      /^<h2[^>]*>\s*JUN\s+NAGAOKA\s*<\/h2>[\s\S]*?(?:<hr\s*\/?>\s*){2,}/i,
      '',
    );
  }
  const chunks = cleaned
    .split(/(?:<hr\s*\/?>\s*){2,}/i)
    .map((p) => p.trim())
    .filter(Boolean);
  return chunks.flatMap((chunk) => expandSpotlightMoviesChunk(chunk));
}

function extractTitleFromHtml(html: string): string {
  for (const m of html.matchAll(/<h3[^>]*>([\s\S]*?)<\/h3>/gi)) {
    const text = stripTags(m[1]);
    if (text.length > 3) return text;
  }
  for (const m of html.matchAll(/<h4[^>]*>([\s\S]*?)<\/h4>/gi)) {
    const text = stripTags(m[1]);
    if (text.length > 8 && !/iframe/i.test(m[0])) return text;
  }
  const fallback = stripTags(html).slice(0, 80);
  return fallback || 'Untitled project';
}

function parseChunk(html: string, source: PortfolioSource): Omit<GalleryProject, 'id' | 'layout' | 'mergedFrom'> & { keys: string[] } {
  const title = extractTitleFromHtml(html);

  const creditMatch = html.match(/<h4[^>]*>[\s\S]*?<a[^>]+>([^<]+)<\/a>/i);
  const creditAlt = html.match(/<h4[^>]*>([^<]{3,120})<\/h4>/i);
  const credit = creditMatch?.[1]?.trim() || (creditAlt && !creditAlt[1].includes('iframe') ? stripTags(creditAlt[1]) : undefined);

  const youtubeIds = [
    ...new Set(
      [...html.matchAll(/youtube\.com\/embed\/([^"?&\s]+)/gi)].map((m) => m[1].replace(/\/$/, '')),
    ),
  ];

  const imgMatches = [...html.matchAll(/<img[^>]+>/gi)];
  const images: GalleryImage[] = [];
  const seenImg = new Set<string>();
  for (const tag of imgMatches) {
    const src = tag[0].match(/\ssrc="([^"]+)"/i)?.[1];
    if (!src || !src.includes('/assets/wp-import/')) continue;
    const basename = src.split('/').pop() || src;
    if (LEGACY_NAV_ICON_FILES.has(basename)) continue;
    if (seenImg.has(basename)) continue;
    seenImg.add(basename);
    const alt = tag[0].match(/\salt="([^"]*)"/i)?.[1] || basename;
    images.push({ src, alt });
  }

  const videos: GalleryVideo[] = youtubeIds.map((id) => ({ youtubeId: id }));

  const notes: string[] = [];
  for (const p of html.match(/<p[^>]*>[\s\S]*?<\/p>/gi) || []) {
    if (/<img|<iframe/i.test(p)) continue;
    const text = stripTags(p);
    if (text.length < 12 || text.length > 220) continue;
    if (!notes.includes(text)) notes.push(text);
  }

  const keys: string[] = [];
  for (const id of youtubeIds) keys.push(`yt:${id}`);
  const normTitle = normalizeTitle(title);
  if (normTitle.length > 3) keys.push(`title:${normTitle}`);
  for (const img of images.slice(0, 3)) {
    const base = img.src.split('/').pop();
    if (base) keys.push(`img:${base}`);
  }
  if (!keys.length) keys.push(`len:${html.length}`);

  return { title, credit, notes: notes.slice(0, 3), images, videos, sources: [source], keys };
}

const CANONICAL_DISPLAY_TITLES: Record<string, string> = {
  pearl: 'PEARL',
  'on ice': 'ON ICE',
  'google spotlight stories': 'Google Spotlight Stories',
};

function pickMergedTitle(a: string, b: string): string {
  const aNorm = normalizeTitle(a);
  const bNorm = normalizeTitle(b);
  if (CANONICAL_DISPLAY_TITLES[aNorm]) return CANONICAL_DISPLAY_TITLES[aNorm];
  if (CANONICAL_DISPLAY_TITLES[bNorm]) return CANONICAL_DISPLAY_TITLES[bNorm];
  const aBad = /worked as td generalist/i.test(a) || a.length > 48;
  const bBad = /worked as td generalist/i.test(b) || b.length > 48;
  if (aBad && !bBad) return b;
  if (bBad && !aBad) return a;
  return a.length >= b.length ? a : b;
}

function mergeProjects(a: GalleryProject, b: GalleryProject, mergedKey: string): GalleryProject {
  const title = pickMergedTitle(a.title, b.title);
  const images: GalleryImage[] = [];
  const seen = new Set<string>();
  for (const img of [...a.images, ...b.images]) {
    const key = img.src.split('/').pop() || img.src;
    if (seen.has(key)) continue;
    seen.add(key);
    images.push(img);
  }
  const videos: GalleryVideo[] = [];
  const seenYt = new Set<string>();
  for (const v of [...a.videos, ...b.videos]) {
    if (seenYt.has(v.youtubeId)) continue;
    seenYt.add(v.youtubeId);
    videos.push(v);
  }
  const sources = [...new Set([...a.sources, ...b.sources])];
  const notes = [...new Set([...a.notes, ...b.notes])].slice(0, 4);
  const credit = a.credit || b.credit;
  const mergedFrom = [...new Set([...a.mergedFrom, ...b.mergedFrom, mergedKey])];
  return {
    ...a,
    title,
    credit,
    notes,
    images,
    videos,
    sources,
    mergedFrom,
  };
}

function isSpotlightCompoundProject(p: GalleryProject): boolean {
  const names = new Set(p.images.map((i) => imageBasename(i.src)));
  return SPOTLIGHT_COMPOUND_IMAGES.every((name) => names.has(name));
}

function isEvilEyeClusterProject(p: GalleryProject): boolean {
  const t = normalizeTitle(p.title);
  if (t === 'pearl' || t === 'on ice' || t === 'google spotlight stories') return true;
  if (p.id === 'pearl' || p.id === 'on-ice') return true;
  return isSpotlightCompoundProject(p);
}

function shouldMerge(a: GalleryProject, b: GalleryProject): string | null {
  const aKeys = new Set<string>();
  const bKeys = new Set<string>();
  for (const v of a.videos) aKeys.add(`yt:${v.youtubeId}`);
  for (const v of b.videos) bKeys.add(`yt:${v.youtubeId}`);
  const aTitle = normalizeTitle(a.title);
  const bTitle = normalizeTitle(b.title);
  const distinctSpotlight =
    new Set([aTitle, bTitle]).has('pearl') && new Set([aTitle, bTitle]).has('on ice');
  if (distinctSpotlight) return null;
  if (aTitle && aTitle === bTitle) return `title:${aTitle}`;
  for (const k of aKeys) {
    if (bKeys.has(k)) return k;
  }
  if (isSpotlightCompoundProject(a) || isSpotlightCompoundProject(b)) {
    if (aTitle !== bTitle && aTitle !== 'pearl' && bTitle !== 'pearl') return null;
  }
  if (aTitle.length > 8 && bTitle.length > 8 && (aTitle.includes(bTitle) || bTitle.includes(aTitle))) {
    const aImg = new Set(a.images.map((i) => imageBasename(i.src)));
    const shared = b.images.some((i) => aImg.has(imageBasename(i.src)));
    if (shared) return `title-sub:${aTitle}|${bTitle}`;
  }
  return null;
}

export interface EvilEyeCurateReport {
  absorbedPanelIds: string[];
  duplicateStandalonePearlRemoved: number;
  panelsMergedIntoOne: number;
}

export interface GalleryLayoutReport {
  myvrPanelsRemoved: number;
  /** Gallery panel ids from Mission onward after row curation. */
  idsFromMission: string[];
  /** Ids after Insight — must match pre-curate tail order. */
  tailAfterInsightIds: string[];
}

function isMyvrAppPanel(p: GalleryProject): boolean {
  if (p.id === 'myvr-app') return true;
  if (MYVR_TITLE_RE.test(p.title)) return true;
  return p.images.some((img) => imageBasename(img.src) === 'myvr_web.jpg');
}

function removeMyvrAppPanel(projects: GalleryProject[]): { projects: GalleryProject[]; removed: number } {
  const before = projects.length;
  const filtered = projects.filter((p) => !isMyvrAppPanel(p));
  return { projects: filtered, removed: before - filtered.length };
}

function expandRowSequenceIds(seq: readonly (string | readonly [string, string])[]): string[] {
  const ids: string[] = [];
  for (const entry of seq) {
    if (typeof entry === 'string') ids.push(entry);
    else ids.push(...entry);
  }
  return ids;
}

function curateGalleryRowOrder(projects: GalleryProject[]): {
  projects: GalleryProject[];
  idsFromMission: string[];
  tailAfterInsightIds: string[];
} {
  const missionIdx = projects.findIndex((p) => p.id === MISSION_PANEL_ID);
  if (missionIdx < 0) {
    return { projects, idsFromMission: [], tailAfterInsightIds: [] };
  }

  const above = projects.slice(0, missionIdx);
  const fromMissionOriginal = projects.slice(missionIdx);
  const insightIdx = fromMissionOriginal.findIndex((p) => p.id === INSIGHT_PANEL_ID);
  const tailAfterInsightIds =
    insightIdx >= 0 ? fromMissionOriginal.slice(insightIdx + 1).map((p) => p.id) : [];

  const curatedMiddleIds = expandRowSequenceIds(GALLERY_ROW_SEQUENCE_FROM_MISSION);
  const targetIds = [...curatedMiddleIds, ...tailAfterInsightIds];

  const fromMissionIds = new Set(fromMissionOriginal.map((p) => p.id));
  const targetFromMission = targetIds.filter((id) => fromMissionIds.has(id));
  if (targetFromMission.length !== fromMissionOriginal.length) {
    return {
      projects,
      idsFromMission: fromMissionOriginal.map((p) => p.id),
      tailAfterInsightIds,
    };
  }

  const byId = new Map(projects.map((p) => [p.id, p]));
  const reorderedBelow = targetIds
    .map((id) => byId.get(id))
    .filter((p): p is GalleryProject => Boolean(p));

  return {
    projects: [...above, ...reorderedBelow],
    idsFromMission: reorderedBelow.map((p) => p.id),
    tailAfterInsightIds,
  };
}

function normalizeMarvelYoutube(projects: GalleryProject[]): GalleryProject[] {
  return projects.map((p) => {
    if (p.id !== MARVEL_PANEL_ID && !normalizeTitle(p.title).includes('marvel mighty heroes')) {
      return p;
    }
    const videos =
      p.videos.length > 0
        ? p.videos.map((v) => ({ ...v, youtubeId: MARVEL_YOUTUBE_ID }))
        : [{ youtubeId: MARVEL_YOUTUBE_ID }];
    return { ...p, videos };
  });
}

function curateEvilEyePicturesPanel(projects: GalleryProject[]): {
  projects: GalleryProject[];
  evilEyeReport: EvilEyeCurateReport;
} {
  const absorbed = projects.filter(isEvilEyeClusterProject);
  if (!absorbed.length) {
    return {
      projects,
      evilEyeReport: {
        absorbedPanelIds: [],
        duplicateStandalonePearlRemoved: 0,
        panelsMergedIntoOne: 0,
      },
    };
  }

  const hadStandalonePearl = absorbed.some(
    (p) => normalizeTitle(p.title) === 'pearl' && p.id === 'pearl',
  );

  const evilEyeLayout: EvilEyeStructuredLayout = {
    spotlight: {
      src: '/assets/wp-import/image1.jpeg',
      alt: 'Google Spotlight Stories',
    },
    pearl: {
      still: {
        src: '/assets/wp-import/image3.jpeg',
        alt: 'Pearl still',
        captionText: EVIL_EYE_PEARL_CAPTION,
      },
      youtubeId: 'WqCH4DNQBUA',
      videoAlt: 'Pearl — Google Spotlight Stories',
    },
    onIce: {
      still: {
        src: '/assets/wp-import/image4.jpeg',
        alt: 'On Ice still',
        captionText: EVIL_EYE_ON_ICE_CAPTION,
      },
      youtubeId: '0cYI8AXkC2I',
      videoAlt: 'On Ice — Google Spotlight Stories',
    },
  };

  const evilEye: GalleryProject = {
    id: EVIL_EYE_PANEL_ID,
    title: 'Evil Eye Pictures, San Francisco',
    credit: 'Google Spotlight Stories — Pearl & On Ice',
    notes: [],
    images: [],
    videos: [],
    sources: [...new Set(absorbed.flatMap((p) => p.sources))],
    layout: 'feature',
    mergedFrom: absorbed.map((p) => p.id),
    evilEyeLayout,
  };

  const rest = projects.filter((p) => !absorbed.includes(p));
  const waterIdx = rest.findIndex((p) => p.id === WATER_PANEL_ID);
  const insertAt = waterIdx >= 0 ? waterIdx + 1 : rest.length;
  const ordered = [...rest.slice(0, insertAt), evilEye, ...rest.slice(insertAt)];

  return {
    projects: ordered,
    evilEyeReport: {
      absorbedPanelIds: absorbed.map((p) => p.id),
      duplicateStandalonePearlRemoved: hadStandalonePearl ? 1 : 0,
      panelsMergedIntoOne: Math.max(0, absorbed.length - 1),
    },
  };
}

let galleryCache: {
  projects: GalleryProject[];
  dedupeReport: DedupeReportEntry[];
  evilEyeReport: EvilEyeCurateReport;
  layoutReport: GalleryLayoutReport;
} | null = null;

export function resetPortfolioGalleryCache(): void {
  galleryCache = null;
}

export function buildPortfolioGallery(): {
  projects: GalleryProject[];
  dedupeReport: DedupeReportEntry[];
  evilEyeReport: EvilEyeCurateReport;
  layoutReport: GalleryLayoutReport;
} {
  if (galleryCache) return galleryCache;
  const raw: (GalleryProject & { keys: string[] })[] = [];
  let idx = 0;

  for (const { source, html, stripHero } of SOURCES) {
    for (const chunk of splitChunks(html, stripHero)) {
      if (isObsoleteNavChunk(chunk)) continue;
      const parsed = parseChunk(chunk, source);
      const id = slugify(parsed.title, idx++);
      raw.push({
        ...parsed,
        id,
        layout: 'compact',
        mergedFrom: [],
      });
    }
  }

  let projects: GalleryProject[] = raw.map(({ keys: _keys, ...rest }) => rest);
  const dedupeReport: DedupeReportEntry[] = [];

  let merged = true;
  while (merged) {
    merged = false;
    outer: for (let i = 0; i < projects.length; i++) {
      for (let j = i + 1; j < projects.length; j++) {
        const reason = shouldMerge(projects[i], projects[j]);
        if (!reason) continue;
        const combined = mergeProjects(projects[i], projects[j], reason);
        combined.id = projects[i].id;
        dedupeReport.push({
          canonicalId: combined.id,
          title: combined.title,
          mergedKeys: [...combined.mergedFrom],
          sources: combined.sources,
        });
        projects = [...projects.slice(0, i), combined, ...projects.slice(i + 1, j), ...projects.slice(j + 1)];
        merged = true;
        break outer;
      }
    }
  }

  projects = projects
    .filter((p) => !(p.images.length === 0 && p.videos.length === 0))
    .filter((p) => !/^(animation|resume|miscellaneous)$/i.test(p.title.trim()));

  const { projects: withoutMyvr, removed: myvrPanelsRemoved } = removeMyvrAppPanel(projects);
  projects = withoutMyvr;

  const { projects: curated, evilEyeReport } = curateEvilEyePicturesPanel(projects);
  const rowOrder = curateGalleryRowOrder(curated);
  projects = normalizeMarvelYoutube(rowOrder.projects);
  const layoutReport: GalleryLayoutReport = {
    myvrPanelsRemoved,
    idsFromMission: rowOrder.idsFromMission,
    tailAfterInsightIds: rowOrder.tailAfterInsightIds,
  };

  projects = projects.map((p, i) => {
    const soloRow = (SOLO_ROW_PANEL_IDS as readonly string[]).includes(p.id);
    const rowPair = GALLERY_ROW_PAIR_IDS.has(p.id);
    let layout =
      p.id === EVIL_EYE_PANEL_ID || PAIR_HERO_FEATURE_IDS.has(p.id) || soloRow
        ? ('feature' as const)
        : rowPair
          ? ('wide' as const)
          : p.layout === 'compact'
            ? LAYOUT_CYCLE[i % LAYOUT_CYCLE.length]
            : p.layout;
    return { ...p, layout };
  });

  if (evilEyeReport.absorbedPanelIds.length) {
    dedupeReport.push({
      canonicalId: EVIL_EYE_PANEL_ID,
      title: 'Evil Eye Pictures, San Francisco',
      mergedKeys: evilEyeReport.absorbedPanelIds.map((id) => `panel:${id}`),
      sources: ['presentation', 'movies'],
    });
  }

  galleryCache = { projects, dedupeReport, evilEyeReport, layoutReport };
  return galleryCache;
}
