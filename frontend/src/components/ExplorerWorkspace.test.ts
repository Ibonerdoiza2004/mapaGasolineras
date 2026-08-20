import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const explorerCss = readFileSync(resolve(process.cwd(), 'src/styles/explorer.css'), 'utf8');
const leafletMapCss = readFileSync(resolve(process.cwd(), 'src/styles/leaflet-map.css'), 'utf8');
const workspaceAstro = readFileSync(
	resolve(process.cwd(), 'src/components/ExplorerWorkspace.astro'),
	'utf8',
);

function normalize(css: string) {
	return css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ').trim();
}

function mediaBlock(css: string, query: string) {
	const start = css.indexOf(query);
	if (start === -1) throw new Error(`Media query no encontrada: ${query}`);
	return extractBlock(css, css.indexOf('{', start));
}

function extractBlock(css: string, openBrace: number) {
	let depth = 0;
	for (let i = openBrace; i < css.length; i += 1) {
		if (css[i] === '{') depth += 1;
		else if (css[i] === '}') {
			depth -= 1;
			if (depth === 0) return css.slice(openBrace + 1, i);
		}
	}
	throw new Error('Bloque CSS sin cerrar');
}

const firstMediaQuery = explorerCss.indexOf('@media');
const desktopCss = normalize(explorerCss.slice(0, firstMediaQuery));
const tabletCss = normalize(mediaBlock(explorerCss, '@media (max-width: 64rem)'));
const mobileLandscapeCss = normalize(
	mediaBlock(explorerCss, '@media (max-width: 64rem) and (max-height: 30rem)'),
);
const mobileCss = normalize(mediaBlock(explorerCss, '@media (max-width: 48rem)'));
const leafletCss = normalize(leafletMapCss);

describe('ExplorerWorkspace — vista de escritorio', () => {
	it('usa una rejilla de panel, mapa y columna de comparación', () => {
		expect(desktopCss).toContain(
			'.explorer { display: grid; flex: 1; grid-template-columns: minmax(20rem, 25rem) minmax(0, 1fr) auto;',
		);
	});

	it('coloca el panel de comparar en la tercera columna', () => {
		expect(desktopCss).toContain('grid-column: 3;');
	});

	it('ocupa el alto restante bajo la cabecera sin dejar hueco inferior', () => {
		expect(desktopCss).toContain('.explorer { display: grid; flex: 1;');
		expect(desktopCss).not.toContain('calc(100vh -');
	});

	it('mantiene el panel lateral siempre visible y oculta el resumen deslizable', () => {
		expect(desktopCss).toContain('.explorer__sidebar > summary { display: none; }');
	});

	it('recorta el contenido para evitar desbordamiento horizontal', () => {
		expect(desktopCss).toContain('.explorer { display: grid;');
		expect(desktopCss).toContain('overflow: hidden;');
	});
});

describe('ExplorerWorkspace — vista de tableta', () => {
	it('reduce el ancho del panel lateral en la rejilla', () => {
		expect(tabletCss).toContain(
			'.explorer { grid-template-columns: minmax(18rem, 21rem) minmax(0, 1fr); }',
		);
	});

	it('estrecha el comparador en tablet', () => {
		expect(tabletCss).toContain('.compare-panel { padding: var(--space-3); width: 17rem; }');
	});
});

describe('ExplorerWorkspace — vista de móvil', () => {
	it('apila el contenido y extiende el mapa hasta el borde del resumen plegado', () => {
		expect(mobileCss).toContain('.explorer { display: block;');
		// El mapa ocupa viewport − 4.75rem (franja del resumen plegado) y no depende
	// del min-height de 320 px (que en móvil horizontal inflaría el mapa y
	// cortaría la citación): se anula el piso y se fija con inset absoluto.
	expect(mobileCss).toContain('inset: 0 0 4.75rem 0;');
	expect(mobileCss).toContain('min-height: 0;');
	expect(mobileCss).toContain('position: absolute;');
	// La cadena de altura del mapa: wrapper y contenedor a altura 100% sin piso.
	expect(mobileCss).toContain('.leaflet-map__container { height: 100%;');
	expect(mobileCss).toMatch(/\.leaflet-map__container.*min-height: 0;/);
});

	it('convierte el panel lateral en una hoja inferior anclada abajo', () => {
		expect(mobileCss).toContain('.explorer__sidebar { background: var(--color-surface);');
		expect(mobileCss).toContain('position: absolute;');
		expect(mobileCss).toContain('bottom: 0;');
		expect(mobileCss).toContain('height: 72%;');
	});

	it('deja el scroll de la hoja al contenido y no al details', () => {
		// Con `height` definida y `overflow: hidden` en el details, el
		// `.explorer__sidebar-content` ocupa la altura restante bajo el resumen
		// (inset) y es el que se desplaza; el details no rebasa sus límites.
		expect(mobileCss).toContain('overflow: hidden;');
		expect(mobileCss).toContain('inset: 4.75rem 0 0 0;');
		expect(mobileCss).toContain('position: absolute;');
		expect(mobileCss).toContain('.explorer__sidebar-content {');
		expect(mobileCss).toContain('overflow-y: auto;');
	});

	it('permite plegar y desplegar la hoja con el atributo open', () => {
		expect(mobileCss).toContain('.explorer__sidebar:not([open]) { height: 4.75rem; }');
		expect(mobileCss).toContain('.explorer__sidebar > summary {');
		expect(mobileCss).toContain('display: flex;');
	});

		it('rediseña el resumen móvil: botón rectangular apetado y flecha grande que gira', () => {
		// La franja <summary> centra el botón: la línea fina con esquinas RECTAS
		// abraza apegadamente la flecha y el contador (no todo el ancho de la
		// franja). La flecha es grande, sin círculo, y gira 180º: cerrado apunta
		// arriba. Se quita el texto 'Gasolineras cercanas'. No hay asa ni flecha
		// a los lados.
		expect(workspaceAstro).not.toContain('explorer__summary-grabber');
		expect(workspaceAstro).not.toContain('explorer__summary-chip');
		expect(workspaceAstro).not.toContain('explorer__summary-chevron');
		expect(workspaceAstro).not.toContain('<strong>Gasolineras cercanas</strong>');
		expect(workspaceAstro).toContain('class="explorer__summary-toggle"');
		expect(workspaceAstro).toContain('class="explorer__summary-arrow"');
		expect(workspaceAstro).toContain('class="explorer__summary-count"');
		expect(workspaceAstro).toContain('<small>0 resultados</small>');
		expect(mobileCss).toContain('.explorer__summary-toggle {');
		// El borde fino abraza el botón apetado (toggle), con esquinas rectas.
		expect(mobileCss).toContain('border: 1px solid var(--color-border-strong);');
		expect(mobileCss).toContain('border-radius: 0;');
		expect(mobileCss).toContain('.explorer__sidebar > summary:hover {');
		// La franja <summary> no lleva borde propio (solo fondo centrado).
		expect(mobileCss).toContain('.explorer__sidebar > summary {');
		expect(mobileCss).toContain('width: 100%;');
		// Flecha grande, sin círculo (no hay border-radius: 50% alrededor).
		expect(mobileCss).toContain('.explorer__summary-arrow {');
		expect(mobileCss).toContain('font-size: 2rem;');
		// La flecha gira al estar plegado (cerrado apunta arriba).
		expect(mobileCss).toContain('.explorer__sidebar:not([open]) .explorer__summary-arrow {');
		expect(mobileCss).toContain('transform: rotate(180deg);');
		expect(mobileCss).toContain('.explorer__summary-count small {');
		expect(mobileCss).not.toContain('explorer__summary-grabber');
		expect(mobileCss).not.toContain('explorer__summary-chip');
	});

	it('permite desplazar el contenido sin bloquear el mapa', () => {
		expect(mobileCss).toContain('.explorer__sidebar-content {');
		expect(mobileCss).toContain('overflow-y: auto;');
	});

	it('impide que el contenido rebote fuera de sus límites', () => {
		expect(mobileCss).toContain('.explorer__sidebar-content {');
		expect(mobileCss).toContain('overscroll-behavior: none;');
	});

	it('mantiene la alineación de marcas', () => {
			expect(normalize(explorerCss)).toContain('.explorer__brand-option input {');
			// La regla general `.explorer input` impone min-height y padding; el
			// checkbox los resetea para no estirarse y desalinear la marca.
			expect(normalize(explorerCss)).toContain('min-height: 0;');
			expect(normalize(explorerCss)).toContain('padding: 0;');
			expect(normalize(explorerCss)).toContain('border: 0;');
			expect(normalize(explorerCss)).toContain('width: 1rem;');
			expect(normalize(explorerCss)).not.toContain('transform: translateY(-15%);');
		});
});

describe('ExplorerWorkspace — superposición y gestos táctiles', () => {
	it('crea un contexto de apilamiento propio para el mapa', () => {
		expect(desktopCss).toContain('.explorer__map { background: #dce7e4;');
		expect(desktopCss).toContain('isolation: isolate;');
		expect(desktopCss).toContain('z-index: 0;');
		expect(mobileCss).toContain('.explorer__sidebar { background: var(--color-surface);');
		expect(mobileCss).toContain('z-index: 2;');
		expect(mobileCss).toContain('isolation: isolate;');
	});

	it('mantiene el comparador por encima del mapa en escritorio', () => {
		expect(desktopCss).toContain('.compare-panel { border-left: 1px solid var(--color-border);');
		expect(desktopCss).toContain('position: relative;');
		expect(desktopCss).toContain('z-index: 1;');
	});

	it('cede los gestos táctiles al mapa', () => {
		expect(leafletCss).toContain('.leaflet-map__container { height: 100%;');
		expect(leafletCss).toContain('touch-action: none;');
	});

	it('permite desplazar el panel móvil sin bloquear el resto de gestos', () => {
		expect(mobileCss).toContain('.explorer__sidebar > summary {');
		expect(mobileCss).toContain('touch-action: manipulation;');
		expect(mobileCss).toContain('.explorer__sidebar-content {');
		expect(mobileCss).toContain('touch-action: pan-y;');
	});
});

describe('ExplorerWorkspace — áreas táctiles y límites', () => {
	it('usa controles con un área táctil mínima de 44px', () => {
		expect(desktopCss).toContain('.explorer input, .explorer select { background: var(--color-surface);');
		expect(desktopCss).toContain('min-height: 2.75rem;');
		expect(desktopCss).toContain('.explorer__input-wrap input { background: transparent; border: 0; min-height: 2.75rem;');
		expect(desktopCss).toContain('.explorer__segment { background: transparent; border: 0;');
		expect(desktopCss).toContain('.explorer__chips { display: flex; flex-wrap: wrap;');
		expect(desktopCss).toContain('.map-controls button { background: var(--color-surface);');
		expect(desktopCss).toContain('height: 2.75rem;');
	});

	it('mantiene rectas las esquinas de los controles de zoom', () => {
		expect(leafletCss).toContain('.leaflet-bar.zoom-control { border: 1px solid var(--color-border); border-radius: 0;');
		expect(leafletCss).toContain('.zoom-control__button:first-child { border-radius: 0; }');
		expect(leafletCss).toContain('.zoom-control__button--bottom { border-bottom: 0; border-radius: 0; }');
	});

	it('sin suelo de altura: el mapa llena el alto que deja la cabecera', () => {
		// En pantallas bajas (tablets en horizontal, móviles cortos) un alto
		// mínimo obligaba a desplazar toda la página para ver el mapa; con
		// `min-height: 0` el explorador llena el espacio restante (flex: 1).
		expect(desktopCss).toContain('min-height: 0;');
		expect(mobileCss).toContain('min-height: 0;');
		expect(desktopCss).not.toContain('min-height: 38rem;');
		expect(mobileCss).not.toContain('min-height: 30rem;');
	});

	it('oculta el comparador en móvil horizontal', () => {
		expect(mobileLandscapeCss).toContain('.compare-panel { display: none; }');
		expect(mobileLandscapeCss).toContain('.station-detail__overlay { left: 21rem; }');
	});

	it('eleva el mapa cuando la ficha está abierta', () => {
		expect(desktopCss).toContain('.explorer__map:has(.station-detail__overlay) { z-index: 1100; }');
	});
});

describe('ExplorerWorkspace — contrato de marcado responsive', () => {
	it('expone una hoja inferior deslizable mediante details/summary', () => {
		expect(workspaceAstro).toContain('<details class="explorer__sidebar" open>');
		expect(workspaceAstro).toContain('<summary>');
		expect(workspaceAstro).toContain('Gasolineras cercanas');
	});

	it('incluye mapa, filtros, resultados y las islas React', () => {
		expect(workspaceAstro).toContain('class="explorer__map"');
		expect(workspaceAstro).toContain('explorer__filters');
		expect(workspaceAstro).toContain('<LeafletMap');
		expect(workspaceAstro).toContain('<FuelFilter client:load />');
		expect(workspaceAstro).toContain('<StationList client:load />');
		expect(workspaceAstro).toContain('client:load');
	});
});

describe('ExplorerWorkspace — overscroll del documento', () => {
		it('mantiene la página sin scroll de documento pero deja libre el gesto nativo de actualización', () => {
		const layoutCss = normalize(readFileSync(resolve(process.cwd(), 'src/styles/layout.css'), 'utf8'));
		// `height: 100%` forma la cadena de altura para el mapa, pero no se
		// fuerza `overflow: hidden` en el documento: con el scroll del documento
		// bloqueado el navegador no dispara pull-to-refresh al arrastrar la
		// cabecera. El rebote se acota en cada contenedor interno.
		expect(layoutCss).toContain('html, body { height: 100%;');
		expect(layoutCss).not.toContain('overflow: hidden');
		expect(layoutCss).not.toContain('overscroll-behavior');
	});
});

describe('ExplorerWorkspace — feedback de acciones', () => {
	it('da al popup del mapa una superficie propia y un hover discreto', () => {
		expect(leafletCss).toContain('.leaflet-popup-content-wrapper { background: var(--color-surface);');
		expect(leafletCss).toContain('.station-popup { display: grid; gap: var(--space-2);');
		expect(leafletCss).toContain('.station-popup button:hover { background: var(--color-surface-emphasis);');
		expect(leafletCss).toContain(
			'.station-popup .station-popup__primary:hover { background: color-mix(in srgb, var(--color-brand-700) 88%, var(--color-surface));',
		);
		expect(leafletCss).toContain('.station-popup button:focus-visible { box-shadow: var(--focus-ring); outline: none; }');
	});

	it('separa el hover sutil del anillo reservado al foco de teclado en las tarjetas', () => {
		expect(desktopCss).toContain('.station-card__action:hover { background: var(--color-surface-emphasis);');
		expect(desktopCss).toContain('.station-card__action:focus-visible { box-shadow: var(--focus-ring);');
		expect(desktopCss).not.toContain('.station-card__action:hover, .station-card__action:focus-visible');
	});

	it('usa el mismo hover contenido para los botones primarios del panel y el popup', () => {
		const hover = 'background: color-mix(in srgb, var(--color-brand-700) 88%, var(--color-surface));';
		expect(desktopCss).toContain('.station-card__action--primary:hover { ' + hover);
		expect(desktopCss).toContain('color: var(--color-text-on-brand);');
		expect(normalize(explorerCss)).toContain('.compare-panel__detail:hover { ' + hover);
		expect(leafletCss).toContain(
			'.station-popup .station-popup__primary:hover { ' + hover,
		);
	});
});
