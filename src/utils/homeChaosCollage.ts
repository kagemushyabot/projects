import { buildPortfolioGallery, EVIL_EYE_PANEL_ID, type GalleryProject } from './portfolioGallery';

export interface HomeChaosCollageItem {
  projectId: string;
  title: string;
  /** Site asset path (`/assets/...`) or absolute YouTube thumb URL. */
  src: string;
  alt: string;
}

/** Work Experience intro hero stills (same files as `WorkExperienceIntro.astro`). */
export const HOME_WORK_INTRO_STILLS: HomeChaosCollageItem[] = [
  {
    projectId: 'work-intro-tactic-studio-featured',
    title: 'Tactic Studio',
    src: '/assets/work-intro/tactic-studio-featured.png',
    alt: 'Tactic Studio featured',
  },
  {
    projectId: 'work-intro-splattic-featured',
    title: 'Splattic',
    src: '/assets/work-intro/splattic-featured.png',
    alt: 'Splattic featured',
  },
];

export type GalleryStillRole = 'gallery-still' | 'work-intro-still';

export interface GalleryStillInventoryEntry {
  projectId: string;
  title: string;
  src: string;
  alt: string;
  role: GalleryStillRole;
}

/** Same caps as `PortfolioGallery.astro` visible still tiles (not `+N` overflow). */
function maxVisibleGalleryImages(layout: GalleryProject['layout']): number {
  return layout === 'feature' ? 14 : layout === 'wide' ? 10 : 8;
}

/**
 * Every genuine still surfaced on `/work-experience/` (gallery still-open tiles + intro heroes).
 * Excludes video-thumb poster slots by construction — only still roles from gallery data/render.
 */
export function buildGalleryStillInventory(): GalleryStillInventoryEntry[] {
  const { projects } = buildPortfolioGallery();
  const out: GalleryStillInventoryEntry[] = [];

  for (const project of projects) {
    if (project.evilEyeLayout) {
      const layout = project.evilEyeLayout;
      out.push(
        {
          projectId: project.id,
          title: project.title,
          src: layout.spotlight.src,
          alt: layout.spotlight.alt,
          role: 'gallery-still',
        },
        {
          projectId: project.id,
          title: project.title,
          src: layout.pearl.still.src,
          alt: layout.pearl.still.alt,
          role: 'gallery-still',
        },
        {
          projectId: project.id,
          title: project.title,
          src: layout.onIce.still.src,
          alt: layout.onIce.still.alt,
          role: 'gallery-still',
        },
      );
      continue;
    }

    const visible = project.images.slice(0, maxVisibleGalleryImages(project.layout));
    for (const img of visible) {
      out.push({
        projectId: project.id,
        title: project.title,
        src: img.src,
        alt: img.alt,
        role: 'gallery-still',
      });
    }
  }

  for (const intro of HOME_WORK_INTRO_STILLS) {
    out.push({
      projectId: intro.projectId,
      title: intro.title,
      src: intro.src,
      alt: intro.alt,
      role: 'work-intro-still',
    });
  }

  return out;
}

function isExcludedVideoPosterUrl(src: string): boolean {
  return src.includes('img.youtube.com/vi/') || src.includes('mqdefault.jpg');
}

/** Stills and wp-import paths only — never YouTube/Vimeo poster URLs. */
export function pickStillVisual(project: GalleryProject): { src: string; alt: string } | null {
  if (project.id === EVIL_EYE_PANEL_ID && project.evilEyeLayout) {
    return {
      src: project.evilEyeLayout.spotlight.src,
      alt: project.evilEyeLayout.spotlight.alt,
    };
  }
  const img = project.images[0];
  if (img) return { src: img.src, alt: img.alt };
  return null;
}

export interface HomeSlideshowAllStillsAudit {
  galleryStillInventory: GalleryStillInventoryEntry[];
  galleryStillInventoryCount: number;
  galleryStillInventoryUniqueUrls: string[];
  includedStills: HomeChaosCollageItem[];
  includedStillsCount: number;
  missingStillUrls: string[];
  extraStillUrls: string[];
  excludedVideoOnlyProjects: { projectId: string; title: string; youtubeIds: string[] }[];
  videoPosterUrlsInSlideshow: string[];
  inventoryMatch: boolean;
  zeroMissingStills: boolean;
  zeroVideoPosters: boolean;
}

/** @deprecated Use `auditHomeSlideshowAllStills` — kept for older capture scripts. */
export interface HomeSlideshowSourceAudit {
  included: { projectId: string; title: string; src: string }[];
  excluded: { projectId: string; title: string; youtubeIds: string[] }[];
}

export function auditHomeSlideshowAllStills(): HomeSlideshowAllStillsAudit {
  const inventory = buildGalleryStillInventory();
  const included = buildHomeStillSlideshowItems();
  const inventoryUnique = [...new Set(inventory.map((row) => row.src))];
  const includedUrls = included.map((row) => row.src);
  const includedSet = new Set(includedUrls);

  const missingStillUrls = inventoryUnique.filter((src) => !includedSet.has(src));
  const inventorySet = new Set(inventoryUnique);
  const extraStillUrls = includedUrls.filter((src) => !inventorySet.has(src));

  const videoPosterUrlsInSlideshow = includedUrls.filter(isExcludedVideoPosterUrl);

  const { projects } = buildPortfolioGallery();
  const excludedVideoOnlyProjects: HomeSlideshowAllStillsAudit['excludedVideoOnlyProjects'] = [];
  for (const project of projects) {
    const hasStillInInventory = inventory.some((row) => row.projectId === project.id);
    if (!hasStillInInventory && project.videos.length > 0) {
      excludedVideoOnlyProjects.push({
        projectId: project.id,
        title: project.title,
        youtubeIds: project.videos.map((v) => v.youtubeId),
      });
    }
  }

  return {
    galleryStillInventory: inventory,
    galleryStillInventoryCount: inventory.length,
    galleryStillInventoryUniqueUrls: inventoryUnique,
    includedStills: included,
    includedStillsCount: included.length,
    missingStillUrls,
    extraStillUrls,
    excludedVideoOnlyProjects,
    videoPosterUrlsInSlideshow,
    inventoryMatch: missingStillUrls.length === 0 && extraStillUrls.length === 0,
    zeroMissingStills: missingStillUrls.length === 0,
    zeroVideoPosters: videoPosterUrlsInSlideshow.length === 0,
  };
}

export function auditHomeSlideshowSources(): HomeSlideshowSourceAudit {
  const audit = auditHomeSlideshowAllStills();
  return {
    included: audit.includedStills.map(({ projectId, title, src }) => ({ projectId, title, src })),
    excluded: audit.excludedVideoOnlyProjects.map((row) => ({
      projectId: row.projectId,
      title: row.title,
      youtubeIds: row.youtubeIds,
    })),
  };
}

/** Still-only slideshow — every gallery still + intro heroes; dedupe identical URLs. */
export function buildHomeStillSlideshowItems(): HomeChaosCollageItem[] {
  const inventory = buildGalleryStillInventory();
  const seen = new Set<string>();
  const items: HomeChaosCollageItem[] = [];

  for (const row of inventory) {
    if (seen.has(row.src)) continue;
    if (isExcludedVideoPosterUrl(row.src)) continue;
    seen.add(row.src);
    items.push({
      projectId: row.projectId,
      title: row.title,
      src: row.src,
      alt: row.alt,
    });
  }

  return items;
}

function pickVisual(project: GalleryProject): { src: string; alt: string } | null {
  if (project.id === EVIL_EYE_PANEL_ID && project.evilEyeLayout) {
    return {
      src: project.evilEyeLayout.spotlight.src,
      alt: project.evilEyeLayout.spotlight.alt,
    };
  }
  const img = project.images[0];
  if (img) return { src: img.src, alt: img.alt };
  const vid = project.videos[0];
  if (vid) {
    return {
      src: `https://img.youtube.com/vi/${vid.youtubeId}/mqdefault.jpg`,
      alt: project.title,
    };
  }
  return null;
}

/** One still/thumb per gallery project — titles match `buildPortfolioGallery()` exactly. */
export function buildHomeChaosCollageItems(): HomeChaosCollageItem[] {
  const { projects } = buildPortfolioGallery();
  const items: HomeChaosCollageItem[] = [];
  for (const project of projects) {
    const visual = pickVisual(project);
    if (!visual) continue;
    items.push({
      projectId: project.id,
      title: project.title,
      src: visual.src,
      alt: visual.alt,
    });
  }
  return items;
}
