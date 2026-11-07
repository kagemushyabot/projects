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
  layout: 'compact' | 'wide' | 'tall' | 'feature';
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

/** WordPress-era section nav icons (not portfolio media). */
const LEGACY_NAV_ICON_FILES = new Set([
  'anim_icon.png',
  'misc_icon.png',
  'resume_icon1.png',
  'still_icon2.png',
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
  return cleaned
    .split(/(?:<hr\s*\/?>\s*){2,}/i)
    .map((p) => p.trim())
    .filter(Boolean);
}

function parseChunk(html: string, source: PortfolioSource): Omit<GalleryProject, 'id' | 'layout' | 'mergedFrom'> & { keys: string[] } {
  const titleMatch = html.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i);
  const titleRaw = titleMatch ? stripTags(titleMatch[1]) : stripTags(html).slice(0, 80);
  const title = titleRaw || 'Untitled project';

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

function mergeProjects(a: GalleryProject, b: GalleryProject, mergedKey: string): GalleryProject {
  const title = a.title.length >= b.title.length ? a.title : b.title;
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

function shouldMerge(a: GalleryProject, b: GalleryProject): string | null {
  const aKeys = new Set<string>();
  const bKeys = new Set<string>();
  for (const v of a.videos) aKeys.add(`yt:${v.youtubeId}`);
  for (const v of b.videos) bKeys.add(`yt:${v.youtubeId}`);
  const aTitle = normalizeTitle(a.title);
  const bTitle = normalizeTitle(b.title);
  if (aTitle && aTitle === bTitle) return `title:${aTitle}`;
  for (const k of aKeys) {
    if (bKeys.has(k)) return k;
  }
  if (aTitle.length > 8 && bTitle.length > 8 && (aTitle.includes(bTitle) || bTitle.includes(aTitle))) {
    const aImg = new Set(a.images.map((i) => i.src.split('/').pop()));
    const shared = b.images.some((i) => aImg.has(i.src.split('/').pop()));
    if (shared) return `title-sub:${aTitle}|${bTitle}`;
  }
  return null;
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
    .filter((p) => !/^(animation|resume|miscellaneous)$/i.test(p.title.trim()))
    .map((p, i) => ({
      ...p,
      layout: LAYOUT_CYCLE[i % LAYOUT_CYCLE.length],
    }));

  galleryCache = { projects, dedupeReport };
  return galleryCache;
}
