# Plan de mejoras — Mapa de Gasolineras

Plan de actuación propuesto a partir del informe Lighthouse (rendimiento 67,
accesibilidad 97, buenas prácticas 96, SEO 92) y de la estrategia de
indexación. Cada cambio debe acompañarse de sus pruebas (unitarias/E2E) y
registrarse en `PROGRESS.md`.

## A. Ya implementado — pendiente de desplegar

- [x] Saneo de coordenadas invertidas (la estación 16268 deja de rechazarse).
- [x] Cliente HTTP moderno (`java.net.http` / JdkClientHttpRequestFactory) — negocia TLS/ALPN.
- [x] Reintentos en la importación — 4 intentos con 30 s de espera ante cortes
      transitorios del WAF (configurable por entorno).
- [ ] **HACERLO TÚ:** Commit, merge a `main` y redespliegue en Oracle. Después de
      desplegar, verificar en el log que la importación completa un ciclo y que los
      reintentos no entran en bucle infinito.

## B. SEO / Indexación (rápido, bajo riesgo)

- [x] `robots.txt` real (endpoint `frontend/src/pages/robots.txt.ts`) — corrige
      los 34 errores de rastreo.
- [x] Sitemap con la integración `@astrojs/sitemap` (434 páginas generadas).
- [ ] **HACERLO TÚ:** Alta en Google Search Console (ahorrar repostando cuando
      exista el dominio) y envío del sitemap. Acción manual en el panel de Google.
- [x] Datos estructurados JSON-LD (`WebSite`/`Place`) y metadescripciones
      OG por página (`BaseLayout` + `seo.ts`).

## C. Rendimiento (Lighthouse 67 → objetivo ≥90)

- [x] Carga diferida: `LeafletMap` y las islas no críticas (`StationDetail`,
      `ComparePanel`, `BrandFilter`, `PriceFilter`) hidratan con `client:idle`
      tras el primer pintado; el resto sigue en `client:load`. Ataca el bloqueo
      inicial de `client.js` + Leaflet (LCP 4.4 s / TBT 690 ms).
- [x] Proxy de teselas en WebP: `tile-proxy/` (Node + sharp) autocontenido que
      convierte las teselas de OSM a WebP y las cachea. `BaseLayout` emite el
      `preconnect` del proveedor configurado con `PUBLIC_MAP_TILE_URL`.
- [ ] **HACERLO TÚ (despliegue del proxy):** crear el registro DNS `tiles`
      apuntando a la IP de la VM, redesplegar en Oracle (`docker compose up -d
      --build` en `docker-compose.prod.yml`), comprobar
      `curl -sI https://tiles.DOMINIO/16/34684/22495.png | grep -i content-type`
      (debe devolver `image/webp`) y fijar
      `PUBLIC_MAP_TILE_URL=https://tiles.DOMINIO/{z}/{x}/{y}.png` en Cloudflare
      Pages. No recargar Caddy antes de que exista el DNS.
- [x] `detectRetina: true` en el tile layer (nitidez en pantallas de alta densidad).
- [x] `preconnect`/`dns-prefetch` a los dominios de teselas y la API.
- [x] Compresión gzip habilitada en la API (`server.compression.enabled=true`;
      brotli lo aplica Cloudflare en el borde).

## D. Accesibilidad (97)

- [x] Touch targets de clústeres ≥44 px + `aria-label` descriptivo y test
      (requisito de altura mínima de AGENTS.md).

## E. Seguridad / Buenas prácticas (96)

- [x] CSP verificada contra el build real de Astro (scripts inline de
      hidratación permitidos con `'unsafe-inline'`/`'unsafe-eval'`) — las
      islas siguen hidratando según los E2E.
- [x] HSTS, COOP, `X-Content-Type-Options`, `Referrer-Policy`,
      `Permissions-Policy` vía `_headers` de Cloudflare Pages y cabeceras del
      backend (`SecurityHeadersFilter`).

## F. SEO estructural (Fase 5)

- [x] Landing pages por municipio generadas desde el catálogo de 8.132 municipios
      (`gasolineras-baratas-[slug].astro`, 432 municipios ≥20 000 habitantes),
      sin precios estáticos (evitar contenido obsoleto), enlazando a la app con
      `?lat=&lon=&lugar=` → la isla `DeepLinkLocation` dispara la ubicación y
      aterriza en «Radio de búsqueda: 10 km» (no en modo área).
- [ ] (Opcional) Páginas curadas de rutas (A-6, Madrid–Valencia) en una segunda
      iteración.

## Marca y rebranding (futuro: ahorra repostando)

- [x] Marca aplicada: `seo.siteName` = «Ahorra Repostando», usado en cabecera,
      `og:site_name`, JSON-LD, favicon y landing pages. La URL del sitio es
      `PUBLIC_SITE_URL`.
- [ ] **HACERLO TÚ (cuando se registre el dominio):** fijar `PUBLIC_SITE_URL` a
      `https://ahorrarepostando.es` en el despliegue (Cloudflare Pages). No hay
      que tocar más código: cabecera, metas, sitemap, robots y landing pages lo
      heredan de `seo.ts`.
- [x] Eliminados los emojis de la interfaz (⛽ de la cabecera sustituido por un
      icono SVG de surtidor; ☀/☾ del selector de tema por iconos SVG sol/luna,
      con visibilidad controlada por CSS según el tema) y de `README.md`.

## Verificación transversal

- [ ] **HACERLO TÚ:** Reejecutar Lighthouse en móvil y escritorio tras el
      despliegue para confirmar la mejora real.
- [x] Cada cambio con sus pruebas (unitarias/E2E) y registro en `PROGRESS.md`:
      backend 184/184, frontend unitario 416/416, E2E 55 passed + 11 skipped,
      lint, typecheck y build limpios.