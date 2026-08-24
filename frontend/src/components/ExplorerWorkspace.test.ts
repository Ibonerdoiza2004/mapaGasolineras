import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');
const workspace = read('src/components/ExplorerWorkspace.astro');
const explorerCss = read('src/styles/explorer.css').replace(/\s+/g, ' ');
const mapCss = read('src/styles/vector-map.css').replace(/\s+/g, ' ');
const vectorMap = read('src/components/VectorMap.tsx');
const stationList = read('src/components/StationList.tsx');
const securityHeaders = read('public/_headers');

describe('ExplorerWorkspace — mapa vectorial responsive', () => {
	it('monta MapLibre como isla React y no conserva la implementación raster', () => {
		expect(workspace).toContain("import VectorMap from './VectorMap'");
		expect(workspace).toContain('<VectorMap');
		expect(workspace).toContain("import VectorMap from './VectorMap'");
	});

	it('mantiene mapa, filtros, listado, detalle y comparador', () => {
		for (const expected of ['explorer__map', '<FuelFilter client:load />', '<StationList client:load />', '<StationDetail client:load />', '<ComparePanel client:load />']) {
			expect(workspace).toContain(expected);
		}
	});

	it('llena el espacio restante en escritorio y conserva la hoja móvil', () => {
		expect(explorerCss).toContain('.explorer { display: grid; flex: 1;');
		expect(explorerCss).toContain('.explorer__sidebar:not([open]) { height: 4.75rem; }');
		expect(explorerCss).toContain('inset: 0 0 4.75rem 0;');
		expect(explorerCss).toContain('.explorer__map .vector-map');
	});

	it('cede los gestos táctiles al lienzo y expone controles de 44 px', () => {
		expect(mapCss).toContain('.vector-map__container { height: 100%; touch-action: none;');
		expect(mapCss).toContain('.location-marker { background: var(--color-surface); border: 3px solid var(--color-brand-700); border-radius: 50%; box-shadow: var(--shadow-md); height: 26px; pointer-events: none;');
		expect(mapCss).toContain('height: 2.75rem;');
		expect(mapCss).toContain('width: 2.75rem;');
	});

	it('dibuja estaciones y clústeres en capas nativas sin marcadores HTML por estación', () => {
		expect(vectorMap).toContain("cluster: true");
		expect(vectorMap).toContain("type: 'geojson'");
		expect(vectorMap).toContain("id: STATION_CLUSTER_LAYER_ID");
		expect(vectorMap).not.toContain('clusterizeStations(');
		expect(vectorMap).not.toContain("element.className = 'station-marker'");
	});

	it('pagina la lista extensa y evita maquetar tarjetas fuera del viewport', () => {
		expect(stationList).toContain('LIST_PAGE_SIZE = 50');
		expect(stationList).toContain('visibleStations = stations.slice(0, visibleCount)');
		expect(explorerCss).toContain('contain-intrinsic-block-size: 11rem;');
		expect(explorerCss).toContain('content-visibility: auto;');
	});

	it('ofrece foco visible y alternativa accesible cuando falla WebGL', () => {
		expect(mapCss).toContain('.vector-map__container .maplibregl-canvas:focus-visible');
		expect(mapCss).toContain('.vector-map__fallback');
		expect(mapCss).toContain('box-shadow: var(--focus-ring);');
	});

	it('mantiene la atribución visible en móvil', () => {
		expect(explorerCss).toContain('.vector-map__container .maplibregl-ctrl-attrib');
		expect(mapCss).toContain('.maplibregl-ctrl-attrib');
	});

	it('permite el worker local de MapLibre sin abrir scripts ni objetos externos', () => {
		expect(securityHeaders).toContain("worker-src 'self' blob:");
		expect(securityHeaders).toContain("object-src 'none'");
	});
});
