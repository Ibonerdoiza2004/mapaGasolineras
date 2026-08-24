import { chromium } from '@playwright/test';

const siteUrl = process.env.MAP_SMOKE_URL ?? 'http://host.docker.internal:4321/';
const browser = await chromium.launch({ headless: true });
const screenshotPath = process.env.MAP_SMOKE_SCREENSHOT;
const zoomSteps = Number.parseInt(process.env.MAP_SMOKE_ZOOM_STEPS ?? '0', 10);
const requestedTheme = process.env.MAP_SMOKE_THEME;
const stationSeeds = [
	['madrid-1', 40.4168, -3.7038, 1.459], ['madrid-2', 40.46, -3.62, 1.479],
	['madrid-3', 40.35, -3.78, 1.499], ['toledo', 39.8628, -4.0273, 1.519],
	['avila', 40.6565, -4.6812, 1.529], ['segovia', 40.9429, -4.1088, 1.489],
	['salamanca', 40.9701, -5.6635, 1.509], ['valladolid', 41.6523, -4.7245, 1.469],
	['zaragoza-1', 41.6488, -0.8891, 1.479], ['zaragoza-2', 41.71, -0.82, 1.499],
	['valencia-1', 39.4699, -0.3763, 1.459], ['valencia-2', 39.52, -0.31, 1.489],
	['albacete', 38.9943, -1.8585, 1.529], ['ciudad-real', 38.9848, -3.9274, 1.539],
	['cuenca', 40.0704, -2.1374, 1.499], ['caceres', 39.4753, -6.3724, 1.519],
	['badajoz', 38.8794, -6.9707, 1.489], ['cordoba', 37.8882, -4.7794, 1.469],
	['jaen', 37.7796, -3.7849, 1.499], ['murcia', 37.9922, -1.1307, 1.479],
];
const smokeStations = stationSeeds.map(([id, latitud, longitud, precio], index) => ({
	id, rotulo: `Estación ${index + 1}`, latitud, longitud, precio,
	mejorOpcion: index === 0, fechaActualizacion: new Date().toISOString(),
}));

try {
	const page = await browser.newPage({ viewport: { width: 1536, height: 900 } });
	await page.route('**/api/**', (route) => {
		const body = new URL(route.request().url()).pathname.endsWith('/api/stations/map')
			? JSON.stringify(smokeStations)
			: '[]';
		return route.fulfill({ status: 200, contentType: 'application/json', body });
	});
	await page.route('**/actuator/health', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{"status":"UP"}' }));
	const pmtilesResponses = [];
	const contextResponses = [];
	const regionalContextResponses = [];
	const cityResponses = [];
	const browserErrors = [];
	page.on('pageerror', (error) => browserErrors.push(error.message));
	page.on('console', (message) => {
		if (message.type() === 'error' && !message.text().startsWith('Failed to load resource:')) {
			browserErrors.push(message.text());
		}
	});
	page.on('response', (response) => {
		if (response.url().endsWith('/maps/spain.pmtiles')) pmtilesResponses.push(response);
		if (response.url().endsWith('/context/ne_110m_land.geojson')) contextResponses.push(response);
		if (response.url().endsWith('/context/iberia_land.geojson')) regionalContextResponses.push(response);
		if (response.url().endsWith('/context/spain_cities.geojson')) cityResponses.push(response);
	});
	const documentResponse = await page.goto(siteUrl, { waitUntil: 'domcontentloaded' });
	if (!documentResponse?.ok()) throw new Error(`El frontend respondió ${documentResponse?.status() ?? 'sin respuesta'}`);
	try {
		await page.getByRole('button', { name: 'Acercar mapa' }).waitFor({ state: 'visible', timeout: 60_000 });
	} catch (error) {
		throw new Error(`MapLibre no se hidrató${browserErrors.length ? `: ${browserErrors.join(' | ')}` : ''}`, { cause: error });
	}
	await page.waitForFunction(() => performance.getEntriesByType('resource').some(
		(entry) => entry.name.endsWith('/maps/spain.pmtiles'),
	), undefined, { timeout: 60_000 });
	const response = pmtilesResponses.find((candidate) => candidate.status() === 206);
	if (!response) {
		throw new Error(`El PMTiles no respondió 206 (respuestas: ${pmtilesResponses.map((candidate) => candidate.status()).join(', ') || 'ninguna'})`);
	}
	const contextResponse = contextResponses.find((candidate) => candidate.ok());
	if (!contextResponse) {
		throw new Error(`El contexto Natural Earth no respondió correctamente (respuestas: ${contextResponses.map((candidate) => candidate.status()).join(', ') || 'ninguna'})`);
	}
	const regionalContextResponse = regionalContextResponses.find((candidate) => candidate.ok());
	if (!regionalContextResponse) {
		throw new Error(`El contexto insular no respondió correctamente (respuestas: ${regionalContextResponses.map((candidate) => candidate.status()).join(', ') || 'ninguna'})`);
	}
	const cityResponse = cityResponses.find((candidate) => candidate.ok());
	if (!cityResponse) {
		throw new Error(`La capa de ciudades no respondió correctamente (respuestas: ${cityResponses.map((candidate) => candidate.status()).join(', ') || 'ninguna'})`);
	}
	if (await page.getByRole('alert').filter({ hasText: 'No se pudo cargar el mapa' }).count()) {
		throw new Error('MapLibre mostró el fallback en lugar del mapa vectorial');
	}
	await page.waitForFunction(
		(expected) => document.querySelector('[data-station-count]')?.getAttribute('data-station-count') === String(expected),
		smokeStations.length,
		{ timeout: 30_000 },
	);
	if (requestedTheme === 'dark') {
		await page.getByRole('button', { name: 'Activar modo oscuro' }).click();
		await page.locator('html[data-theme="dark"]').waitFor({ state: 'attached' });
		await page.waitForFunction(
			(expected) => document.querySelector('[data-station-count]')?.getAttribute('data-station-count') === String(expected),
			smokeStations.length,
			{ timeout: 30_000 },
		);
	}
	for (let step = 0; step < (Number.isFinite(zoomSteps) ? Math.max(0, zoomSteps) : 0); step += 1) {
		await page.getByRole('button', { name: 'Acercar mapa' }).click();
	}
	if (browserErrors.length) {
		throw new Error(`El navegador registró errores durante el mapa: ${browserErrors.join(' | ')}`);
	}
	if (screenshotPath) {
		await page.waitForTimeout(3_000);
		await page.screenshot({ path: screenshotPath, fullPage: true });
	}
	console.log(`Mapa local en Chromium: OK (PMTiles ${response.status()}, contexto ${contextResponse.status()}, islas ${regionalContextResponse.status()}, ciudades ${cityResponse.status()})`);
} finally {
	await browser.close();
}
