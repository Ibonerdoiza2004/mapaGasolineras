# Plan de mejoras — Mapa de Gasolineras

Plan de actuación propuesto a partir del informe Lighthouse (rendimiento 67,
accesibilidad 97, buenas prácticas 96, SEO 92) y de la estrategia de
indexación. Cada cambio debe acompañarse de sus pruebas (unitarias/E2E) y
registrarse en `PROGRESS.md`.

**Estado actual (medido en producción, `mapagasolineras.pages.dev`):**
rendimiento **75**, accesibilidad **97**, buenas prácticas **100**, SEO **100**.
La arquitectura del mapa ya usa un PMTiles vectorial propio z0–z15, renderizado
en el navegador hasta z19. El artefacto completo está generado y validado en
local; quedan el despliegue y la medición final en producción.

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

- [x] Carga diferida: `VectorMap` y las islas no críticas (`StationDetail`,
      `ComparePanel`, `BrandFilter`, `PriceFilter`) hidratan con `client:idle`
      tras el primer pintado; el resto sigue en `client:load`.
- [x] Pipeline reproducible de España + Canarias a un único PMTiles z0–z15,
      validado y publicado de forma atómica con versiones recuperables.
- [x] Servicio estático en Caddy con peticiones Range, CORS explícito y caché;
      no existe conversión ni generación en la ruta de una petición web.
- [x] MapLibre GL JS renderiza el vector en GPU, mantiene z19 mediante overzoom
      del detalle z15 y usa la densidad real del dispositivo para Retina.
- [x] CSS inline en el HTML (`build.inlineStylesheets: 'always'`) — elimina el
      CSS bloqueante (Lighthouse estimaba −330 ms).
- [x] El archivo persistente vive fuera del directorio reemplazado por deploy;
      la actualización conmuta el enlace estable solo tras validarlo.
- [x] `preconnect` al dominio del PMTiles y la API.
- [x] Compresión gzip habilitada en la API (`server.compression.enabled=true`;
      brotli lo aplica Cloudflare en el borde).
- [x] Generar y validar localmente el PMTiles completo de España y Canarias.
- [ ] Desplegarlo y repetir Lighthouse para medir
      LCP/TBT, tráfico Range y tiempo de movimiento/zoom en móvil y escritorio.

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

- [x] Lighthouse de producción previo (móvil, `?combustible=DIESEL`):
      rendimiento 75, accesibilidad 97, buenas prácticas 100 y SEO 100.
- [ ] **HACERLO TÚ:** Reejecutar Lighthouse en móvil y escritorio tras
      desplegar las mejoras C (CSS inline, caché 30 días) para confirmar la
      subida.
- [x] Cada cambio con sus pruebas (unitarias/E2E) y registro en `PROGRESS.md`:
      backend 184/184, frontend unitario 363/363, E2E 56 passed + 10 skipped,
      pipeline PMTiles, Compose, lint, typecheck y build limpios.
