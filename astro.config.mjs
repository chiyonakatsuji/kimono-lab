// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

// Where this build will be served from. The defaults target the GitHub Pages
// project site; a host that serves from a domain root (Cloudflare Pages, a
// custom domain) only needs these two variables set, e.g.
// SITE_URL=https://kimono-lab.example BASE_PATH=/ npm run build
const site = process.env.SITE_URL ?? 'https://chiyonakatsuji.github.io';
const base = process.env.BASE_PATH ?? '/kimono-lab';

// Astro prepends `base` to a redirect's route but not to its target, so the
// target has to carry the prefix itself or "/" lands outside the site.
const basePrefix = base.replace(/\/$/, '');

// https://astro.build/config
export default defineConfig({
  site,
  base,
  i18n: {
    locales: ['ja', 'en'],
    defaultLocale: 'ja',
    routing: {
      // Both languages get a prefix (/ja/, /en/) so neither reads as
      // secondary. "/" redirects to /ja/ below.
      prefixDefaultLocale: true,
    },
  },
  redirects: {
    '/': `${basePrefix}/ja/`,
  },
  vite: {
    plugins: [tailwindcss()]
  }
});
