import { buildPortfolioGallery, EVIL_EYE_PANEL_ID, type GalleryProject } from './portfolioGallery';

export interface HomeChaosCollageItem {
  projectId: string;
  title: string;
  /** Site asset path (`/assets/...`) or absolute YouTube thumb URL. */
  src: string;
  alt: string;
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

export interface HomeSlideshowSourceAudit {
  included: { projectId: string; title: string; src: string }[];
  excluded: { projectId: string; title: string; youtubeIds: string[] }[];
}

export function auditHomeSlideshowSources(): HomeSlideshowSourceAudit {
  const { projects } = buildPortfolioGallery();
  const included: HomeSlideshowSourceAudit['included'] = [];
  const excluded: HomeSlideshowSourceAudit['excluded'] = [];
  for (const project of projects) {
    const still = pickStillVisual(project);
    if (still) {
      included.push({ projectId: project.id, title: project.title, src: still.src });
    } else if (project.videos.length) {
      excluded.push({
        projectId: project.id,
        title: project.title,
        youtubeIds: project.videos.map((v) => v.youtubeId),
      });
    }
  }
  return { included, excluded };
}

/** Still-only slideshow items (no video thumbnails). */
export function buildHomeStillSlideshowItems(): HomeChaosCollageItem[] {
  const { projects } = buildPortfolioGallery();
  const items: HomeChaosCollageItem[] = [];
  for (const project of projects) {
    const visual = pickStillVisual(project);
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
