import { expect, test } from '@playwright/test';

test.describe('disposición — el mapa llena el alto disponible', () => {
	test('el mapa llega hasta el borde inferior del viewport (escritorio)', async ({
		page,
		isMobile,
	}) => {
		test.skip(isMobile, 'disposición de escritorio');
		await page.goto('/');
		await expect(page.getByRole('button', { name: 'Acercar mapa' })).toBeVisible();

		const box = await page.locator('.leaflet-map__container').boundingBox();
		expect(box).not.toBeNull();
		const viewportHeight = await page.evaluate(() => window.innerHeight);
		expect(Math.round((box as { y: number; height: number }).y + (box as { y: number; height: number }).height))
			.toBe(viewportHeight);
	});
});

test.describe('rueda del ratón — zoom en pasos de 0.5', () => {
	test('cada toque de la rueda cuenta un paso, incluso girando rápido', async ({ page, isMobile }) => {
		test.skip(isMobile, 'rueda de ratón de escritorio');
		await page.goto('/');
		await expect(page.getByRole('button', { name: 'Acercar mapa' })).toBeVisible();
		await expect(page.locator('img.leaflet-tile').first()).toBeVisible();

		const box = await page.locator('.leaflet-map__container').boundingBox();
		if (!box) throw new Error('sin caja del mapa');
		await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);

		// Tres toques seguidos (sin esperas) suben de nivel de tesela (z5 -> z6).
		for (let i = 0; i < 3; i += 1) {
			await page.mouse.wheel(0, -100);
		}
		// Las teselas llegan de OSM por red; con la suite en paralelo cargan
		// más lento, así que se espera más que el timeout por defecto.
		await expect(page.locator('img.leaflet-tile[src*="/6/"]').first()).toBeVisible({ timeout: 15_000 });

		// Dos toques seguidos vuelven al nivel anterior (z6 -> z5).
		await page.mouse.wheel(0, 100);
		await page.mouse.wheel(0, 100);
		await expect(page.locator('img.leaflet-tile[src*="/5/"]').first()).toBeVisible({ timeout: 15_000 });
	});
});

test.describe('lector de pantalla — roles y nombres accesibles', () => {
	test('expone los roles y nombres de los controles principales', async ({ page }) => {
		await page.goto('/');

		await expect(page.getByRole('banner')).toBeVisible();
		await expect(page.getByRole('navigation', { name: 'Navegación principal' })).toBeVisible();
		await expect(page.getByRole('main')).toBeVisible();
		await expect(page.getByRole('region', { name: 'Mapa de gasolineras cercanas' })).toBeVisible();

		await expect(page.getByRole('combobox', { name: 'Ubicación' })).toBeVisible();
		await expect(page.getByRole('combobox', { name: 'Combustible' })).toBeVisible();
		await expect(page.getByRole('combobox', { name: 'Radio' })).toBeVisible();
		await expect(page.getByRole('combobox', { name: 'Ordenar resultados' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Usar mi ubicación' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Acercar mapa' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Alejar mapa' })).toBeVisible();

		await expect(page.getByRole('list', { name: 'Lista de gasolineras cercanas' })).toBeVisible();
		await expect(page.getByRole('link', { name: 'Explorar' })).toBeVisible();
		await expect(page.getByRole('link', { name: 'Rutas' })).toBeVisible();
	});
});

test.describe('teclado — orden de foco y operación', () => {
	test('el orden de tabulación sigue la estructura lógica (escritorio)', async ({ page, isMobile }) => {
		test.skip(isMobile, 'orden de tabulación de escritorio');
		await page.goto('/');

		// La isla Leaflet se hidrata de forma asíncrona; se espera a que sus
		// controles existan para que el orden de foco sea estable.
		await expect(page.getByRole('button', { name: 'Acercar mapa' })).toBeVisible();

		const panelOrder = [
			['link', 'Mapa de Gasolineras, inicio'],
			['link', 'Explorar'],
			['link', 'Rutas'],
			['button', 'Activar modo oscuro'],
			['combobox', 'Ubicación'],
			['combobox', 'Combustible'],
			['combobox', 'Radio'],
			['button', 'Usar mi ubicación'],
			['combobox', 'Ordenar resultados'],
		] as const;

		for (const [role, name] of panelOrder) {
			await page.keyboard.press('Tab');
			await expect(page.getByRole(role, { name })).toBeFocused();
		}

		// Tras el panel, el foco entra en el mapa Leaflet (contenedor y
		// marcadores) y desde ahí se alcanzan los controles de zoom con teclado.
		let zoomReached = false;
		for (let i = 0; i < 10 && !zoomReached; i += 1) {
			await page.keyboard.press('Tab');
			zoomReached = await page
				.getByRole('button', { name: 'Acercar mapa' })
				.evaluate((el) => el === document.activeElement);
		}
		await expect(page.getByRole('button', { name: 'Acercar mapa' })).toBeFocused();
	});

	test('el selector de tema se activa con el teclado', async ({ page }) => {
		await page.goto('/');
		await expect(page.getByRole('button', { name: 'Acercar mapa' })).toBeVisible();

		await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

		const toggle = page.getByRole('button', { name: 'Activar modo oscuro' });
		await toggle.focus();
		await page.keyboard.press('Enter');

		await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
		await expect(page.getByRole('button', { name: 'Activar modo claro' })).toBeFocused();
	});

	test('el selector de combustible se opera con el teclado', async ({ page }) => {
		await page.goto('/');

		const fuel = page.getByRole('combobox', { name: 'Combustible' });
		await fuel.focus();
		await page.keyboard.press('ArrowDown');
		await page.keyboard.press('ArrowDown');
		await page.keyboard.press('Enter');

		await expect(fuel).toHaveValue('Gasolina 98');
	});

	test('el panel inferior se abre y cierra solo con teclado (móvil)', async ({ page, isMobile }) => {
		test.skip(!isMobile, 'panel inferior de móvil');
		await page.goto('/');

		const details = page.locator('.explorer__sidebar');
		const summary = page.locator('.explorer__sidebar > summary');

		await expect(details).toHaveAttribute('open', '');

		await summary.focus();
		await summary.press('Enter');
		await expect(details).not.toHaveAttribute('open');

		await summary.press('Enter');
		await expect(details).toHaveAttribute('open', '');

		await summary.press('Escape');
		await expect(details).not.toHaveAttribute('open');
		await expect(summary).toBeFocused();
	});
});

test.describe('geolocalización', () => {
	async function waitForHydration(page: import('@playwright/test').Page) {
		// El botón existe en el HTML de servidor; esperar a que la isla React se
		// hidrate (los controles del mapa solo existen tras la hidratación)
		// para no perder el primer clic.
		await expect(page.getByRole('button', { name: 'Acercar mapa' })).toBeVisible();
	}

	test('con permiso concedido, centra el mapa y confirma la ubicación', async ({ page }) => {
		await page.context().grantPermissions(['geolocation']);
		await page.context().setGeolocation({ latitude: 40.4168, longitude: -3.7038 });
		await page.goto('/');
		await waitForHydration(page);

		await page.getByRole('button', { name: 'Usar mi ubicación' }).click();

		await expect(
			page.getByRole('status').filter({ hasText: 'Gasolineras actualizadas' }),
		).toBeVisible();
	});

	test('con permiso denegado, explica el fallo y ofrece la búsqueda manual', async ({ page }) => {
		await page.goto('/');
		await waitForHydration(page);

		await page.getByRole('button', { name: 'Usar mi ubicación' }).click();

		await expect(
			page.getByRole('alert').filter({ hasText: 'No podemos acceder a tu ubicación' }),
		).toBeVisible();
		await expect(
			page.getByRole('button', { name: 'Buscar por ciudad o código postal' }),
		).toBeVisible();

		await page.getByRole('button', { name: 'Buscar por ciudad o código postal' }).click();
		await expect(page.getByRole('combobox', { name: 'Ubicación' })).toBeFocused();
	});
});
