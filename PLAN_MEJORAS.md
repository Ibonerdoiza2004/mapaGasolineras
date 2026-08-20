# Plan de mejoras — Mapa de Gasolineras

Plan de actuación propuesto a partir del informe Lighthouse (rendimiento 67,
accesibilidad 97, buenas prácticas 96, SEO 92) y de la estrategia de
indexación. Cada cambio debe acompañarse de sus pruebas (unitarias/E2E) y
registrarse en `PROGRESS.md`.

**Estado actual (medido en producción, `mapagasolineras.pages.dev`):**
rendimiento **75**, accesibilidad **97**, buenas prácticas **100**, SEO **100**.
El proxy de teselas WebP está desplegado y sirve `image/webp`; quedan las
mejoras de la sección C.3.

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
      **Desplegado y verificado en prod** (teselas `image/webp` desde
      `tiles.api.51.170.52.206.nip.io`).
- [x] CSS inline en el HTML (`build.inlineStylesheets: 'always'`) — elimina el
      CSS bloqueante (Lighthouse estimaba −330 ms).
- [x] `Cache-Control` de las teselas a 30 días con `stale-while-revalidate` en
      `tile-proxy/server.js` — las revisitas se sirven de caché.
- [x] `detectRetina: true` en el tile layer (nitidez en pantallas de alta densidad).
- [x] `preconnect`/`dns-prefetch` a los dominios de teselas y la API.
- [x] Compresión gzip habilitada en la API (`server.compression.enabled=true`;
      brotli lo aplica Cloudflare en el borde).
- [ ] (Opcional, fase siguiente) LCP 3,7 s y TBT 560 ms: el primer teselado del
      mapa no es descubrible en el HTML inicial (carga tras la hidratación
      `client:idle` de Leaflet) y `client.js` evalúa una tarea larga de ~513 ms.
      Opciones: reducir el JS sin usar (leaflet 61 % / client 42 %), precargar
      las teselas del viewport inicial o `fetchpriority="high"` sobre la primera
      tesela.

## D. Accesibilidad (97 → objetivo 100)

- [x] Touch targets de clústeres ≥44 px + `aria-label` descriptivo y test
      (requisito de altura mínima de AGENTS.md).
- [x] `<summary>` de la hoja inferior con nombre accesible que incluye el texto
      visible: `aria-label` sustituido por un `span.visually-hidden`
      «Gasolineras cercanas» (corrige `label-content-name-mismatch`).
- [ ] (Parcial) `target-size`: los clústeres miden 48 px pero Lighthouse
      puntúa que hay marcadores solapados (área clicable segura < 24 px). Los
      clústeres cercanos se solapan visualmente en el zoom de España entera.

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

- [x] Lighthouse de producción (móvil, `?combustible=DIESEL`): rendimiento 75,
      accesibilidad 97, buenas prácticas 100, SEO 100; teselas WebP verificadas
      en `network-requests`.
- [ ] **HACERLO TÚ:** Reejecutar Lighthouse en móvil y escritorio tras
      desplegar las mejoras C (CSS inline, caché 30 días) para confirmar la
      subida.
- [x] Cada cambio con sus pruebas (unitarias/E2E) y registro en `PROGRESS.md`:
      backend 184/184, frontend unitario 416/416, E2E 55 passed + 11 skipped,
      lint, typecheck y build limpios.