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

export interface GalleryProject {
  id: string;
  title: string;
  credit?: string;
  notes: string[];
  images: GalleryImage[];
  videos: GalleryVideo[];
  sources: PortfolioSource[];
  layout: 'compact' | 'wide' | 'tall' | 'feature' | 'spotlight-lead' | 'spotlight-peer';
  mergedFrom: string[];
}

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

  const creditBlock = chunk.match(
    /<h4[\s\S]*?evileyepictures\.com[\s\S]*?<\/h4>/i,
  )?.[0];

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
  'mission to the deep exhibit': 'Monterey Bay Aquarium — Mission to the Deep',
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

function shouldMerge(a: GalleryProject, b: GalleryProject): string | null {
  const aKeys = new Set<string>();
  const bKeys = new Set<string>();
  for (const v of a.videos) aKeys.add(`yt:${v.youtubeId}`);
  for (const v of b.videos) bKeys.add(`yt:${v.youtubeId}`);
  const aTitle = normalizeTitle(a.title);
  const bTitle = normalizeTitle(b.title);
  if (aTitle && aTitle === bTitle) return `title:${aTitle}`;
  const distinctSpotlight =
    new Set([aTitle, bTitle]).has('pearl') &&
    new Set([aTitle, bTitle]).has('on ice');
  if (distinctSpotlight) return null;
  for (const k of aKeys) {
    if (bKeys.has(k)) return k;
  }
  if (isSpotlightCompoundProject(a) || isSpotlightCompoundProject(b)) {
    if (aTitle !== bTitle && !(aTitle === 'pearl' || bTitle === 'pearl')) {
      return null;
    }
  }
  if (aTitle.length > 8 && bTitle.length > 8 && (aTitle.includes(bTitle) || bTitle.includes(aTitle))) {
    const aImg = new Set(a.images.map((i) => imageBasename(i.src)));
    const shared = b.images.some((i) => aImg.has(imageBasename(i.src)));
    if (shared) return `title-sub:${aTitle}|${bTitle}`;
  }
  return null;
}

export const SPOTLIGHT_CLUSTER_IDS = {
  water: 'water-is-life-hidden-dangers-vr-campaign',
  lead: 'google-spotlight-stories',
  pearl: 'pearl',
  onIce: 'on-ice',
} as const;

export const SPOTLIGHT_BAND_IDS = [
  SPOTLIGHT_CLUSTER_IDS.lead,
  SPOTLIGHT_CLUSTER_IDS.pearl,
  SPOTLIGHT_CLUSTER_IDS.onIce,
] as const;

function canonicalSpotlightIds(projects: GalleryProject[]): void {
  for (const p of projects) {
    const t = normalizeTitle(p.title);
    if (t === 'google spotlight stories') p.id = SPOTLIGHT_CLUSTER_IDS.lead;
    if (t === 'pearl') p.id = SPOTLIGHT_CLUSTER_IDS.pearl;
    if (t === 'on ice') p.id = SPOTLIGHT_CLUSTER_IDS.onIce;
    if (t.includes('mission to the deep') || imageBasename(p.images[0]?.src ?? '') === 'mba_color_2line.jpg') {
      p.id = 'mission-to-the-deep-exhibit';
    }
  }

  const water = projects.find((p) => p.id === SPOTLIGHT_CLUSTER_IDS.water);
  if (water) water.layout = 'feature';
}

function curateSpotlightCluster(projects: GalleryProject[]): GalleryProject[] {
  canonicalSpotlightIds(projects);
  const byId = new Map(projects.map((p) => [p.id, p]));

  const pearl = byId.get(SPOTLIGHT_CLUSTER_IDS.pearl);
  if (pearl) {
    pearl.title = 'PEARL';
    pearl.layout = 'feature';
    pearl.notes = pearl.notes.filter(
      (n) => !/^worked as td generalist$/i.test(n.trim()),
    );
  }
  const onIce = byId.get(SPOTLIGHT_CLUSTER_IDS.onIce);
  if (onIce) {
    onIce.title = 'ON ICE';
    onIce.layout = 'feature';
    onIce.notes = onIce.notes.filter(
      (n) => !/^worked as td generalist$/i.test(n.trim()),
    );
  }
  const lead = byId.get(SPOTLIGHT_CLUSTER_IDS.lead);
  if (lead) {
    lead.title = 'Google Spotlight Stories';
    lead.layout = 'spotlight-lead';
    lead.images = lead.images.filter((i) => imageBasename(i.src) === 'image1.jpeg');
    lead.videos = [];
  }

  const clusterIds = [
    SPOTLIGHT_CLUSTER_IDS.lead,
    SPOTLIGHT_CLUSTER_IDS.pearl,
    SPOTLIGHT_CLUSTER_IDS.onIce,
  ];
  const monterey = projects.find(
    (p) =>
      p.id === 'mission-to-the-deep-exhibit' ||
      p.images.some((i) => imageBasename(i.src) === 'mba_color_2line.jpg'),
  );

  if (monterey) {
    monterey.title = 'Monterey Bay Aquarium — Mission to the Deep';
    monterey.layout = 'feature';
    monterey.id = 'mission-to-the-deep-exhibit';
  }

  const rest = projects.filter(
    (p) => !clusterIds.includes(p.id as (typeof clusterIds)[number]) && p !== monterey,
  );

  const waterAnchor = rest.findIndex((p) => p.id === SPOTLIGHT_CLUSTER_IDS.water);
  const cluster = clusterIds.map((id) => byId.get(id)).filter((p): p is GalleryProject => Boolean(p));

  if (!cluster.length) return projects;

  const head = waterAnchor >= 0 ? rest.slice(0, waterAnchor + 1) : rest;
  const tail = waterAnchor >= 0 ? rest.slice(waterAnchor + 1) : [];
  const afterCluster = monterey ? [monterey, ...tail] : tail;
  return [...head, ...cluster, ...afterCluster];
}

let galleryCache: { projects: GalleryProject[]; dedupeReport: DedupeReportEntry[] } | null = null;

export function resetPortfolioGalleryCache(): void {
  galleryCache = null;
}

export function buildPortfolioGallery(): { projects: GalleryProject[]; dedupeReport: DedupeReportEntry[] } {
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

  projects = curateSpotlightCluster(
    projects.map((p, i) => ({
      ...p,
      layout: p.layout === 'compact' ? LAYOUT_CYCLE[i % LAYOUT_CYCLE.length] : p.layout,
    })),
  );

  projects = projects.map((p, i) => {
    if (
      p.id === SPOTLIGHT_CLUSTER_IDS.lead ||
      p.id === SPOTLIGHT_CLUSTER_IDS.pearl ||
      p.id === SPOTLIGHT_CLUSTER_IDS.onIce ||
      p.id === 'mission-to-the-deep-exhibit' ||
      p.id === SPOTLIGHT_CLUSTER_IDS.water
    ) {
      return p;
    }
    return { ...p, layout: LAYOUT_CYCLE[i % LAYOUT_CYCLE.length] };
  });

  galleryCache = { projects, dedupeReport };
  return galleryCache;
}
