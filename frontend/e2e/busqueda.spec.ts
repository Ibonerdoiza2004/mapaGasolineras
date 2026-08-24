import { expect, test, type Page } from '@playwright/test';

const SUGGESTIONS = [
	{
		id: '230445241',
		label: 'Madrid',
		fullName: 'Madrid, Comunidad de Madrid, España',
		tipo: 'city',
		latitud: 40.4168,
		longitud: -3.7038,
	},
	{
		id: '230445242',
		label: 'Madrid Centro',
		fullName: 'Madrid Centro, Comunidad de Madrid, España',
		tipo: 'suburb',
		latitud: 40.42,
		longitud: -3.705,
	},
];

function stubGeocode(page: Page, body: unknown) {
	page.route('**/api/geocode/search*', (route) =>
		route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) }),
	);
}

// El listado consulta el área visible del mapa al cargar; se simula el
// backend para que la página quede limpia.
test.beforeEach(async ({ page }) => {
	await page.route('**/api/stations/nearby*', (route) =>
		route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
	);
});

test.describe('búsqueda manual — sugerencias y centrado del mapa', () => {
	test('escribir muestra sugerencias y elegir una centra el mapa (escritorio)', async ({
		page,
		isMobile,
	}) => {
		test.skip(isMobile, 'flujo de escritorio');
		stubGeocode(page, SUGGESTIONS);
		await page.goto('/');
		await expect(page.getByRole('button', { name: 'Acercar mapa' })).toBeVisible();

		const search = page.getByRole('combobox', { name: 'Ubicación' });
		await search.fill('madrid');

		const listbox = page.getByRole('listbox', { name: 'Sugerencias de ubicación' });
		await expect(listbox).toBeVisible();
		await expect(page.getByRole('option', { name: /Madrid, Comunidad de Madrid, España/ })).toBeVisible();
		await expect(page.getByRole('option', { name: /Madrid Centro/ })).toBeVisible();

		// La primera recomendación está seleccionada por defecto: Enter la elige.
		await page.keyboard.press('Enter');

		await expect(
			page.getByRole('status').filter({ hasText: 'Gasolineras actualizadas a Madrid.' }),
		).toHaveText('Gasolineras actualizadas a Madrid.');
		await expect(listbox).not.toBeVisible();
		// La búsqueda activa el radio de 10 km y encuadra su circunferencia
		// completa, en lugar de acercarse tanto que el borde quede fuera.
		const map = page.locator('.vector-map');
		await expect(map).toHaveAttribute('data-radius-km', '10');
		await expect.poll(async () => Number(await map.getAttribute('data-map-zoom'))).toBeGreaterThan(10);
		await expect.poll(async () => Number(await map.getAttribute('data-map-zoom'))).toBeLessThan(15);
	});

	test('la búsqueda funciona solo con el teclado (escritorio)', async ({ page, isMobile }) => {
		test.skip(isMobile, 'flujo de teclado de escritorio');
		stubGeocode(page, SUGGESTIONS);
		await page.goto('/');
		await expect(page.getByRole('button', { name: 'Acercar mapa' })).toBeVisible();

		await page.keyboard.press('Tab'); // enlace de la cabecera
		await page.keyboard.press('Tab'); // Explorar
		await page.keyboard.press('Tab'); // Rutas
		await page.keyboard.press('Tab'); // selector de tema
		await page.keyboard.press('Tab'); // usar mi ubicación
		await page.keyboard.press('Tab'); // búsqueda

		const search = page.getByRole('combobox', { name: 'Ubicación' });
		await expect(search).toBeFocused();
		await search.fill('bilbao');
		await expect(
			page.getByRole('listbox', { name: 'Sugerencias de ubicación' }).getByRole('option').first(),
		).toBeVisible();
		await page.keyboard.press('Escape');
		await expect(page.getByRole('listbox')).not.toBeVisible();
		await expect(search).toBeFocused();
	});

	test('sin coincidencias muestra un mensaje claro', async ({ page, isMobile }) => {
		test.skip(isMobile, 'flujo de escritorio');
		stubGeocode(page, []);
		await page.goto('/');
		await expect(page.getByRole('button', { name: 'Acercar mapa' })).toBeVisible();

		await page.getByRole('combobox', { name: 'Ubicación' }).fill('zzz');
		await expect(
			page.getByRole('status').filter({ hasText: 'Sin resultados para «zzz»' }),
		).toHaveText('Sin resultados para «zzz»');
	});

	test('un fallo del geocodificador ofrece reintentar sin perder el campo', async ({ page }) => {
		let calls = 0;
		page.route('**/api/geocode/search*', (route) => {
			calls += 1;
			if (calls === 1) {
				return route.fulfill({ status: 503, body: '{}' });
			}
			return route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify(SUGGESTIONS),
			});
		});
		await page.goto('/');
		await expect(page.getByRole('button', { name: 'Acercar mapa' })).toBeVisible();

		const search = page.getByRole('combobox', { name: 'Ubicación' });
		await search.fill('madrid');

		const alert = page.getByRole('alert').filter({ hasText: 'No se pudo buscar' });
		await expect(alert).toContainText('Reintentar');

		await page.getByRole('button', { name: 'Reintentar' }).click();

		await expect(
			page.getByRole('listbox', { name: 'Sugerencias de ubicación' }).getByRole('option'),
		).toHaveCount(2);
		await expect(search).toHaveValue('madrid');
	});

	test('una consulta demasiado corta no consulta y muestra la pista', async ({ page, isMobile }) => {
		test.skip(isMobile, 'flujo de escritorio');
		const requests: string[] = [];
		page.route('**/api/geocode/search*', (route) => {
			requests.push(route.request().url());
			route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
		});
		await page.goto('/');
		await expect(page.getByRole('button', { name: 'Acercar mapa' })).toBeVisible();

		await page.getByRole('combobox', { name: 'Ubicación' }).fill('ma');

		await expect(
			page.getByRole('status').filter({ hasText: 'Escribe al menos 3 caracteres' }),
		).toHaveText('Escribe al menos 3 caracteres para ver sugerencias.');
		await page.waitForTimeout(700);
		expect(requests).toHaveLength(0);
	});
});
