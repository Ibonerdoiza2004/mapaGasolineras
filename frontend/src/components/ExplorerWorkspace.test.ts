import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const explorerCss = readFileSync(resolve(process.cwd(), 'src/styles/explorer.css'), 'utf8');
const workspaceAstro = readFileSync(
	resolve(process.cwd(), 'src/components/ExplorerWorkspace.astro'),
	'utf8',
);

function normalize(css: string) {
	return css.replace(/\s+/g, ' ').trim();
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
const mobileCss = normalize(mediaBlock(explorerCss, '@media (max-width: 48rem)'));

describe('ExplorerWorkspace — vista de escritorio', () => {
	it('usa una rejilla de dos columnas con el mapa ocupando el resto', () => {
		expect(desktopCss).toContain(
			'.explorer { display: grid; grid-template-columns: minmax(20rem, 25rem) minmax(0, 1fr);',
		);
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
});

describe('ExplorerWorkspace — vista de móvil', () => {
	it('apila el contenido y convierte el mapa en pantalla completa', () => {
		expect(mobileCss).toContain('.explorer { display: block;');
		expect(mobileCss).toContain('.explorer__map { height: 100%; position: absolute; inset: 0; }');
	});

	it('convierte el panel lateral en una hoja inferior anclada abajo', () => {
		expect(mobileCss).toContain('.explorer__sidebar { background: var(--color-surface);');
		expect(mobileCss).toContain('position: absolute;');
		expect(mobileCss).toContain('bottom: 0;');
		expect(mobileCss).toContain('max-height: 72%;');
	});

	it('permite plegar y desplegar la hoja con el atributo open', () => {
		expect(mobileCss).toContain('.explorer__sidebar:not([open]) { max-height: 4.75rem; }');
		expect(mobileCss).toContain('.explorer__sidebar > summary {');
		expect(mobileCss).toContain('display: flex;');
	});

	it('permite desplazar el contenido sin bloquear el mapa', () => {
		expect(mobileCss).toContain('.explorer__sidebar-content { overflow-y: auto;');
	});
});

describe('ExplorerWorkspace — áreas táctiles y límites', () => {
	it('usa controles con un área táctil mínima de 44px', () => {
		expect(desktopCss).toContain('.explorer input, .explorer select { background: var(--color-surface);');
		expect(desktopCss).toContain('min-height: 2.75rem;');
		expect(desktopCss).toContain('.explorer__input-wrap input { background: transparent; border: 0; min-height: 2.75rem;');
		expect(desktopCss).toContain('.explorer__list-heading select { background-color: var(--color-surface-muted);');
		expect(desktopCss).toContain('.map-controls button { background: var(--color-surface);');
		expect(desktopCss).toContain('height: 2.75rem;');
	});

	it('conserva un alto mínimo que mantiene visibles las acciones', () => {
		expect(desktopCss).toContain('min-height: 38rem;');
		expect(mobileCss).toContain('min-height: 30rem;');
	});
});

describe('ExplorerWorkspace — contrato de marcado responsive', () => {
	it('expone una hoja inferior deslizable mediante details/summary', () => {
		expect(workspaceAstro).toContain('<details class="explorer__sidebar" open>');
		expect(workspaceAstro).toContain('<summary>');
	});

	it('incluye mapa, filtros, resultados y la isla de mapa Leaflet', () => {
		expect(workspaceAstro).toContain('class="explorer__map"');
		expect(workspaceAstro).toContain('explorer__filters');
		expect(workspaceAstro).toContain('station-card');
		expect(workspaceAstro).toContain('<LeafletMap');
		expect(workspaceAstro).toContain('client:load');
	});
});
