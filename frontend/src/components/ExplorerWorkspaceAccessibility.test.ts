import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const workspaceAstro = readFileSync(
	resolve(process.cwd(), 'src/components/ExplorerWorkspace.astro'),
	'utf8',
);
const searchBoxSource = readFileSync(resolve(process.cwd(), 'src/components/SearchBox.tsx'), 'utf8');
const fuelFilterSource = readFileSync(resolve(process.cwd(), 'src/components/FuelFilter.tsx'), 'utf8');
const radioFilterSource = readFileSync(resolve(process.cwd(), 'src/components/RadioFilter.tsx'), 'utf8');
const sortFilterSource = readFileSync(resolve(process.cwd(), 'src/components/SortFilter.tsx'), 'utf8');
const stationListSource = readFileSync(resolve(process.cwd(), 'src/components/StationList.tsx'), 'utf8');
const leafletMapSource = readFileSync(resolve(process.cwd(), 'src/components/LeafletMap.tsx'), 'utf8');
const locationButtonSource = readFileSync(
	resolve(process.cwd(), 'src/components/LocationButton.tsx'),
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
		expect(workspaceAstro).toContain('<label class="visually-hidden" for="explorer-search">Ubicación</label>');
		expect(workspaceAstro).toContain('<SearchBox client:load />');
		expect(searchBoxSource).toContain("SEARCH_INPUT_ID = 'explorer-search'");
		expect(searchBoxSource).toContain('type="search"');
		expect(searchBoxSource).toContain(
			"const PLACEHOLDER = 'Ciudad, dirección o código postal'",
		);
		expect(searchBoxSource).toContain('role="combobox"');
		expect(searchBoxSource).toContain('aria-controls={LISTBOX_ID}');
	});

	it('integra el filtro de combustible como grupo de chips accesible', () => {
		expect(workspaceAstro).toContain('<FuelFilter client:load />');
		expect(fuelFilterSource).toContain('role="radiogroup"');
		expect(fuelFilterSource).toContain('aria-labelledby');
		expect(fuelFilterSource).toContain('role="radio"');
		expect(fuelFilterSource).toContain('aria-checked');
	});

	it('etiqueta el selector de radio', () => {
		expect(workspaceAstro).toContain('<RadioFilter client:load />');
		expect(radioFilterSource).toContain('role="radiogroup"');
		expect(radioFilterSource).toContain('aria-labelledby');
		expect(radioFilterSource).toContain('role="radio"');
		expect(radioFilterSource).toContain('aria-checked');
	});

	it('coloca el botón de ubicación justo encima del cuadro de búsqueda', () => {
		const locationIndex = workspaceAstro.indexOf('<LocationButton client:load />');
		const searchIndex = workspaceAstro.indexOf('<SearchBox client:load />');
		expect(locationIndex).toBeGreaterThan(-1);
		expect(searchIndex).toBeGreaterThan(locationIndex);
	});

	it('mantiene el selector de radio junto a la ubicación y el combustible después, dentro del formulario', () => {
		const formEnd = workspaceAstro.indexOf('</form>');
		const radioIndex = workspaceAstro.indexOf('<RadioFilter client:load />');
		const fuelIndex = workspaceAstro.indexOf('<FuelFilter client:load />');
		expect(radioIndex).toBeGreaterThan(-1);
		expect(radioIndex).toBeLessThan(formEnd);
		expect(fuelIndex).toBeGreaterThan(radioIndex);
		expect(fuelIndex).toBeLessThan(formEnd);
	});

	it('el combustible vive en el formulario y el orden junto a «Resultados»', () => {
		const formEnd = workspaceAstro.indexOf('</form>');
		const fuelIndex = workspaceAstro.indexOf('<FuelFilter client:load />');
		const sortIndex = workspaceAstro.indexOf('<SortFilter client:load />');
		expect(fuelIndex).toBeGreaterThan(-1);
		expect(fuelIndex).toBeLessThan(formEnd);
		expect(sortIndex).toBeGreaterThan(formEnd);
		expect(workspaceAstro).toContain('class="explorer__list-actions"');
	});

	it('da un nombre accesible al selector de ordenación', () => {
		expect(workspaceAstro).toContain('<SortFilter client:load />');
		expect(sortFilterSource).toContain('role="radiogroup"');
		expect(sortFilterSource).toContain('aria-labelledby');
		expect(sortFilterSource).toContain('role="radio"');
		expect(sortFilterSource).toContain('aria-checked');
	});

	it('da un nombre visible al botón de usar la ubicación', () => {
		expect(workspaceAstro).toContain('<LocationButton client:load />');
		expect(locationButtonSource).toContain('Usar mi ubicación');
		expect(locationButtonSource).toContain('className="explorer__location"');
	});

	it('integra el mapa Leaflet como isla accesible', () => {
		expect(workspaceAstro).toContain('<LeafletMap');
		expect(workspaceAstro).toContain('client:load');
	});
});

describe('ExplorerWorkspace — paneles y marcadores alternativos', () => {
	it('expone el panel inferior con un nombre accesible en su resumen', () => {
		expect(workspaceAstro).toContain('<details class="explorer__sidebar" open>');
		expect(workspaceAstro).toContain('<strong>Gasolineras cercanas</strong>');
	});

	it('contiene el contenedor del mapa', () => {
		expect(workspaceAstro).toContain('class="explorer__map"');
	});

	it('delega la accesibilidad del mapa a la isla Leaflet con marcadores interactivos', () => {
		expect(leafletMapSource).toContain('role="region"');
		expect(leafletMapSource).toContain('aria-label="Mapa de gasolineras cercanas"');
		expect(leafletMapSource).toContain('keyboard: true');
	});

	it('ofrece una lista ordenada como alternativa a los marcadores numerados', () => {
		expect(workspaceAstro).toContain('<StationList client:load />');
		expect(stationListSource).toContain("'explorer__stations'");
		expect(stationListSource).toContain('aria-label="Lista de gasolineras cercanas"');
		expect(stationListSource).toContain('station-card');
	});

	it('permite desplegar las acciones de una tarjeta con teclado y anunciar el estado', () => {
		expect(stationListSource).toContain('tabIndex={0}');
		expect(stationListSource).toContain('aria-expanded={isExpanded}');
		expect(stationListSource).toContain('Añadir al comparador');
		expect(stationListSource).toContain('Ver ficha');
	});
});

describe('ExplorerWorkspace — foco visible', () => {
	it('muestra un anillo de foco en entradas, selectores, botones y resumen', () => {
expect(explorerCssNormalized).toContain(
		'.explorer input:not(.explorer__input-wrap input):focus-visible, .explorer select:focus-visible, .explorer button:focus-visible, .explorer__sidebar > summary:focus-visible { box-shadow: var(--focus-ring); outline: none; }',
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
