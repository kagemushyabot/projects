export const WORK_EXPERIENCE_PATH = '/work-experience/';

export type WorkExperienceSection = 'custom' | 'images' | 'animation';

/** Unified portfolio page with optional in-page section hash. */
export function workExperienceHref(section?: WorkExperienceSection): string {
  const base = withBase(WORK_EXPERIENCE_PATH);
  return section ? `${base}#${section}` : base;
}

/** Prefix an app-root path with the configured Astro base (e.g. `/projects/`). */
export function withBase(path: string): string {
  const base = import.meta.env.BASE_URL;
  if (!path.startsWith('/')) return `${base}${path}`;
  if (path === '/') return base;
  return `${base}${path.slice(1)}`;
}

/** Fix root-absolute `src` / `href` in migrated WordPress HTML for project Pages. */
export function rewriteImportedHtml(html: string): string {
  const base = import.meta.env.BASE_URL;
  if (base === '/') return html;
  return html.replace(
    /(src|href)=(["'])\/(?!\/)([^"']*)/g,
    (_match, attr: string, quote: string, path: string) => `${attr}=${quote}${base}${path}`,
  );
}
