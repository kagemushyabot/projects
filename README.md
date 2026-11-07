# kagemushya.github.io

Static portfolio for **Jun Nagaoka** — migrated from WordPress to [Astro](https://astro.build/) for GitHub Pages.

## Routes

| Path | Content |
|------|---------|
| `/` | Home (Concept C) |
| `/custom/` | Former `/presentation/` |
| `/images/` | Laser-scan portfolio gallery |
| `/animation/` | Former `/movies/` |
| `/resume/` | 2027 resume HTML + PDF |

## Development

```bash
npm ci
npm run dev
```

## Deploy

Pushes to `main` or `master` run [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml) (GitHub Actions → Pages).

Target URL: **https://kagemushya.github.io/** (requires the `Kagemushya/kagemushya.github.io` repository).
