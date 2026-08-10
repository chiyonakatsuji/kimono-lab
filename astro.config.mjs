// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  site: 'https://kimono-lab.pages.dev',
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
    '/': '/ja/',
  },
  vite: {
    plugins: [tailwindcss()]
  }
});
