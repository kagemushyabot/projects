# kagemushyabot.github.io

Static portfolio for **Jun Nagaoka** — migrated from WordPress to [Astro](https://astro.build/) for GitHub Pages at the site root.

## Routes

| Path | Content |
|------|---------|
| `/` | Home (Concept C when launched; WIP screen otherwise) |
| `/custom/` | Former `/presentation/` |
| `/images/` | Laser-scan portfolio gallery |
| `/animation/` | Former `/movies/` |
| `/resume/` | 2027 resume HTML + PDF |

## Launch / WIP mode

Before public launch, keep the site in **work-in-progress** mode (default):

- Home shows a minimal dark **準備中 / work in progress** page (Concept C typography only).
- Primary navigation is hidden; work routes are not linked from home (URLs still build if visited directly).
- All pages include `noindex, nofollow` while WIP.

**Local preview of the full home:**

```bash
cp .env.example .env
# Edit .env: PUBLIC_SITE_LAUNCH=true
npm run dev
```

**Production launch (full Concept C home + nav):**

1. Copy `.env.example` to `.env` locally with `PUBLIC_SITE_LAUNCH=true`, or
2. In the GitHub repo: **Settings → Secrets and variables → Actions → Variables** → add `PUBLIC_SITE_LAUNCH` = `true`, then re-run the deploy workflow.

Unset or `false` keeps WIP mode.

## Development

```bash
npm ci
npm run dev
```

## Deploy

### User site (`https://kagemushyabot.github.io/`)

Use a repository named **`kagemushyabot.github.io`** on the `kagemushyabot` account (user/organization site = site root).

1. Create an empty public repo: `kagemushyabot/kagemushyabot.github.io` (GitHub → New repository).
2. Push this Astro project to `main` or `master` on that repo (copy from `kagemushyabot/projects` or add a second remote).
3. **Settings → Pages → Build and deployment → Source: GitHub Actions**.
4. Push to `master`/`main` or run **Deploy GitHub Pages** manually.

The Cursor GitHub app cannot create repos or enable Pages; an admin must complete steps 1 and 3 if the integration returns 403.

### Project site (`kagemushyabot/projects`)

Pushes to `main` or `master` run [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml). That URL is `https://kagemushyabot.github.io/projects/` only if Pages is enabled on the `projects` repo (optional staging).
