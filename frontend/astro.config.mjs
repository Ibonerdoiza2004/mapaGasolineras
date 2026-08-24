// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';

const site = (process.env.PUBLIC_SITE_URL || 'https://example.com').replace(/\/$/, '');

// https://astro.build/config
export default defineConfig({
  site,
  integrations: [react(), sitemap()],
  vite: {
    // El smoke local abre Astro desde un contenedor aislado. Este alias solo
    // afecta al servidor de desarrollo; la build estática no expone Vite.
    server: { allowedHosts: ['host.docker.internal'] },
    // MapLibre resuelve su worker como un módulo separado; preempaquetarlo
    // borra esa salida en el servidor dev y deja la isla sin hidratar.
    optimizeDeps: { exclude: ['maplibre-gl'] },
  },
  build: {
    inlineStylesheets: 'always',
  },
});
