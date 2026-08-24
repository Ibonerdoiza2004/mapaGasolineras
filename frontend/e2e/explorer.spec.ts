import { expect, test } from '@playwright/test';

// El listado consulta el área visible del mapa al cargar; se simula el
// backend para que la página quede limpia (sin alertas ni botones extra).
test.beforeEach(async ({ page }) => {
	await page.route('**/api/stations/map*', (route) =>
		route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
	);
	await page.route('**/api/stations/nearby*', (route) =>
		route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
	);
});

test('el mapa carga más de 500 estaciones aunque el listado siga limitado', async ({ page }) => {
	const stations = Array.from({ length: 501 }, (_, index) => ({
		id: `all-${index}`,
		rotulo: `Estación ${index}`,
		latitud: 36 + (index % 80) * 0.05,
		longitud: -8 + (index % 100) * 0.08,
		precio: 1.45,
		mejorOpcion: index === 0,
		fechaActualizacion: '2026-08-22T10:00:00',
	}));
	await page.route('**/api/stations/map*', (route) =>
		route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(stations) }),
	);

	await page.goto('/');

	await expect(page.locator('.vector-map')).toHaveAttribute('data-station-count', '501');
});

test.describe('disposición — el mapa llena el alto disponible', () => {
	test('el mapa llega hasta el borde inferior del viewport (escritorio)', async ({
		page,
		isMobile,
	}) => {
		test.skip(isMobile, 'disposición de escritorio');
		await page.goto('/');
		await expect(page.getByRole('button', { name: 'Acercar mapa' })).toBeVisible();

		const box = await page.locator('.vector-map__container').boundingBox();
		expect(box).not.toBeNull();
		const viewportHeight = await page.evaluate(() => window.innerHeight);
		expect(Math.round((box as { y: number; height: number }).y + (box as { y: number; height: number }).height))
			.toBe(viewportHeight);
	});
});

test.describe('controles del mapa — zoom en pasos de 0.5', () => {
	test('cada pulsación cambia exactamente medio nivel', async ({ page }) => {
		await page.goto('/');
		const map = page.locator('.vector-map');
		await expect(page.getByRole('button', { name: 'Acercar mapa' })).toBeVisible();
		const initial = Number(await map.getAttribute('data-map-zoom'));
		await page.getByRole('button', { name: 'Acercar mapa' }).click();
		await expect.poll(async () => Number(await map.getAttribute('data-map-zoom'))).toBeCloseTo(initial + 0.5, 1);
		await page.getByRole('button', { name: 'Alejar mapa' }).click();
		await expect.poll(async () => Number(await map.getAttribute('data-map-zoom'))).toBeCloseTo(initial, 1);
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
		await expect(page.getByRole('radiogroup', { name: 'Combustible' })).toBeVisible();
		await expect(page.getByRole('radio', { name: 'Diésel' })).toBeVisible();
		await expect(page.getByRole('radio', { name: 'Gasolina 95' })).toBeVisible();
		await expect(page.getByRole('radio', { name: 'Gasolina 98' })).toBeVisible();
		// La opción de radio está visible pero deshabilitada sin ubicación;
		// sus chips solo se muestran al activarla.
		await expect(page.getByRole('radio', { name: 'Radio de búsqueda' })).toBeVisible();
		await expect(page.getByRole('radio', { name: 'Radio de búsqueda' })).toBeDisabled();
		await expect(page.getByRole('radiogroup', { name: 'Radio en kilómetros' })).toHaveCount(0);
		await expect(page.getByRole('radiogroup', { name: 'Ordenar resultados' })).toBeVisible();
		await expect(page.getByRole('radio', { name: 'Más barato' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Usar mi ubicación' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Acercar mapa' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Alejar mapa' })).toBeVisible();

		// El listado de resultados se monta bajo demanda (isla React) y se
		// cubre en filtro.spec.ts con datos simulados del backend.
		await expect(page.getByRole('link', { name: 'Explorar' })).toBeVisible();
		await expect(page.getByRole('link', { name: 'Rutas' })).toBeVisible();
	});
});

test.describe('teclado — orden de foco y operación', () => {
	test('el orden de tabulación sigue la estructura lógica (escritorio)', async ({ page, isMobile }) => {
		test.skip(isMobile, 'orden de tabulación de escritorio');
		await page.goto('/');

		// La isla vectorial se hidrata de forma asíncrona; se espera a que sus
		// controles existan para que el orden de foco sea estable.
		await expect(page.getByRole('button', { name: 'Acercar mapa' })).toBeVisible();

		// Sin ubicación no hay punto de referencia para el radio, así que la
		// opción está deshabilitada y no es tabulable.
		await expect(page.getByRole('radio', { name: 'Radio de búsqueda' })).toBeDisabled();

		const panelOrder = [
			['link', 'Ahorra Repostando, inicio'],
			['link', 'Explorar'],
			['link', 'Rutas'],
			['button', 'Activar modo oscuro'],
			['button', 'Usar mi ubicación'],
			['combobox', 'Ubicación'],
			['radio', 'Área visible en el mapa'],
			['radio', 'Diésel'],
			['radio', 'Más barato'],
		] as const;

		for (const [role, name] of panelOrder) {
			await page.keyboard.press('Tab');
			await expect(page.getByRole(role, { name })).toBeFocused();
		}

		// Tras el panel, el foco entra en el mapa (lienzo y
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

	test('el selector de tema muestra un único icono según el tema', async ({ page }) => {
		await page.goto('/');
		await expect(page.getByRole('button', { name: 'Acercar mapa' })).toBeVisible();

		// Modo claro: solo la luna es visible y el texto del botón no se
		// duplica dentro del área de iconos.
		await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
		await expect(page.locator('[data-theme-icon]')).toHaveCount(2);
		await expect(page.locator('[data-theme-icon="moon"]')).toBeVisible();
		await expect(page.locator('[data-theme-icon="sun"]')).toBeHidden();
		await expect(page.getByRole('button', { name: 'Activar modo oscuro' })).toHaveText('Oscuro');

		// Al pasar a oscuro se intercambia el icono: solo el sol queda visible.
		await page.getByRole('button', { name: 'Activar modo oscuro' }).click();
		await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
		await expect(page.locator('[data-theme-icon="sun"]')).toBeVisible();
		await expect(page.locator('[data-theme-icon="moon"]')).toBeHidden();
		await expect(page.getByRole('button', { name: 'Activar modo claro' })).toHaveText('Claro');
	});

	test('el selector de combustible se opera con el teclado', async ({ page }) => {
		await page.goto('/');

		const diesel = page.getByRole('radio', { name: 'Diésel' });
		await expect(diesel).toHaveAttribute('aria-checked', 'true');

		// La isla del filtro puede hidratarse después de la del mapa; se
		// reintenta el pulsado hasta que el manejador de teclado esté activo.
		await expect
			.poll(async () => {
				await diesel.focus();
				await page.keyboard.press('ArrowRight');
				return page
					.getByRole('radio', { name: 'Gasolina 95' })
					.evaluate((el) => el === document.activeElement);
			})
			.toBe(true);
		await expect(page.getByRole('radio', { name: 'Gasolina 95' })).toHaveAttribute(
			'aria-checked',
			'true',
		);

		await page.keyboard.press('ArrowRight');
		await page.keyboard.press('ArrowRight');

		await expect(page.getByRole('radio', { name: 'Diésel' })).toBeFocused();
		await expect(
			page.getByRole('radio', { name: 'Diésel' }),
		).toHaveAttribute('aria-checked', 'true');
		expect(new URL(page.url()).searchParams.get('combustible')).toBe('DIESEL');
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

test.describe('rotación — el panel lateral reaparece al volver a horizontal', () => {
	test('reabre la hoja plegada en vertical al pasar al layout de escritorio', async ({ page }) => {
		await page.setViewportSize({ width: 760, height: 1024 });
		await page.goto('/');
		await expect(page.getByRole('button', { name: 'Acercar mapa' })).toBeVisible();

		const details = page.locator('.explorer__sidebar');
		await expect(details).toHaveAttribute('open', '');

		// En vertical (layout móvil) se puede plegar la hoja.
		await page.locator('.explorer__sidebar > summary').click();
		await expect(details).not.toHaveAttribute('open');

		// Al rotar a horizontal de tablet (layout con panel izquierdo) la hoja se
		// reabre sola; si quedara cerrada, la columna lateral se vería vacía.
		await page.setViewportSize({ width: 1024, height: 760 });
		await expect(details).toHaveAttribute('open', '');

		// La columna lateral vuelve a tener contenido visible (no vacío).
		const content = page.locator('.explorer__sidebar-content');
		await expect(content).toBeVisible();
		const box = await content.boundingBox();
		expect(box?.width).toBeGreaterThan(200);
		expect(box?.height).toBeGreaterThan(200);
	});

	test('la hoja abierta en vertical se mantiene abierta al rotar', async ({ page }) => {
		await page.setViewportSize({ width: 760, height: 1024 });
		await page.goto('/');
		await expect(page.getByRole('button', { name: 'Acercar mapa' })).toBeVisible();

		const details = page.locator('.explorer__sidebar');
		await expect(details).toHaveAttribute('open', '');

		await page.setViewportSize({ width: 1280, height: 800 });

		await expect(details).toHaveAttribute('open', '');
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
