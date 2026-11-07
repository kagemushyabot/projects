// @ts-check
import { defineConfig } from 'astro/config';

/** GitHub project Pages (`…/projects/`); user site at repo root uses `/`. */
const raw = process.env.PUBLIC_BASE_PATH?.trim();
const base =
  !raw || raw === '/'
    ? '/'
    : `/${raw.replace(/^\/+|\/+$/g, '')}/`;

// https://astro.build/config
export default defineConfig({
  site: 'https://kagemushyabot.github.io',
  base,
  output: 'static',
});
