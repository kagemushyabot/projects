/**
 * Site launch gate. When false, the home page shows a minimal WIP screen and
 * work routes stay out of navigation (direct URLs still build).
 *
 * Set `PUBLIC_SITE_LAUNCH=true` in `.env` or as a GitHub Actions variable when ready.
 */
function parseSiteLaunched(value: string | undefined): boolean {
  if (value === undefined || value === '') return false;
  const normalized = value.trim().toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'yes';
}

export const isSiteLaunched = parseSiteLaunched(import.meta.env.PUBLIC_SITE_LAUNCH);

export const siteConfig = {
  name: 'Jun Nagaoka',
  url: 'https://kagemushyabot.github.io',
  /** When false, add noindex and show WIP home. */
  launched: isSiteLaunched,
} as const;
