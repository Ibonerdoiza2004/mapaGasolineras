import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const workspaceAstro = readFileSync(
	resolve(process.cwd(), 'src/components/ExplorerWorkspace.astro'),
	'utf8',
);
const explorerCss = readFileSync(resolve(process.cwd(), 'src/styles/explorer.css'), 'utf8');
const headerCss = readFileSync(resolve(process.cwd(), 'src/styles/site-header.css'), 'utf8');
const themeToggleCss = readFileSync(resolve(process.cwd(), 'src/styles/theme-toggle.css'), 'utf8');

function normalize(css: string) {
	return css.replace(/\s+/g, ' ').trim();
}

const explorerCssNormalized = normalize(explorerCss);

describe('ExplorerWorkspace — nombres accesibles de controles y filtros', () => {
	it('etiqueta el campo de búsqueda de ubicación', () => {
		expect(workspaceAstro).toContain('<span>Ubicación</span>');
		expect(workspaceAstro).toContain('<input type="search" placeholder="Ciudad, dirección o código postal" />');
	});

	it('etiqueta los selectores de combustible y radio', () => {
		expect(workspaceAstro).toContain('<span>Combustible</span>');
		expect(workspaceAstro).toContain('<span>Radio</span>');
	});

	it('da un nombre accesible al selector de ordenación', () => {
		expect(workspaceAstro).toContain('<span class="visually-hidden">Ordenar resultados</span>');
	});

	it('da un nombre visible al botón de usar la ubicación', () => {
		expect(workspaceAstro).toContain('Usar mi ubicación');
	});

	it('da un nombre accesible a los controles de zoom del mapa', () => {
		expect(workspaceAstro).toContain('aria-label="Acercar mapa"');
		expect(workspaceAstro).toContain('aria-label="Alejar mapa"');
	});
});

describe('ExplorerWorkspace — paneles y marcadores alternativos', () => {
	it('expone el panel inferior con un nombre accesible en su resumen', () => {
		expect(workspaceAstro).toContain('<details class="explorer__sidebar" open>');
		expect(workspaceAstro).toContain('<strong>Gasolineras cercanas</strong>');
	});

	it('marca el mapa como región con nombre accesible', () => {
		expect(workspaceAstro).toContain('role="region"');
		expect(workspaceAstro).toContain('aria-label="Mapa de gasolineras cercanas"');
	});

	it('mantiene los marcadores decorativos fuera del orden de foco', () => {
		const markerMatches = workspaceAstro.match(/class="map-marker[^"]*"[^>]*aria-hidden="true"/g) ?? [];
		expect(markerMatches.length).toBeGreaterThanOrEqual(4);
	});

	it('ofrece una lista ordenada como alternativa a los marcadores numerados', () => {
		expect(workspaceAstro).toContain('<ol class="explorer__stations" aria-label="Lista de gasolineras cercanas">');
		expect(workspaceAstro).toContain('<li class:list={["station-card"');
	});
});

describe('ExplorerWorkspace — foco visible', () => {
	it('muestra un anillo de foco en entradas, selectores, botones y resumen', () => {
		expect(explorerCssNormalized).toContain(
			'.explorer input:focus-visible, .explorer select:focus-visible, .explorer button:focus-visible, .explorer__sidebar > summary:focus-visible { box-shadow: var(--focus-ring); outline: none; }',
		);
	});

	it('muestra un anillo de foco en los enlaces de navegación', () => {
		expect(normalize(headerCss)).toContain(
			'.site-header__nav a:focus-visible, .site-header__brand:focus-visible { box-shadow: var(--focus-ring); outline: none; }',
		);
	});

	it('muestra un anillo de foco en el selector de tema', () => {
		expect(normalize(themeToggleCss)).toContain(
			'.theme-toggle:focus-visible { box-shadow: var(--focus-ring); outline: none; }',
		);
	});
});
