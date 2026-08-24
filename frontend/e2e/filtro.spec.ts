import { expect, test, type Page } from '@playwright/test';

const NEARBY = [
	{
		id: 'st-1',
		rotulo: 'REPSOL Norte',
		direccion: 'Av. de la Industria, 24',
		localidad: 'Madrid',
		provincia: 'Madrid',
		latitud: 40.426,
		longitud: -3.7038,
		distanciaKm: 1.2,
		precio: 1.459,
		ahorro: 0,
		fechaActualizacion: '2026-08-17T10:00:00Z',
	},
	{
		id: 'st-2',
		rotulo: 'CEPSA Centro',
		direccion: 'Calle Mayor, 108',
		localidad: 'Madrid',
		provincia: 'Madrid',
		latitud: 40.4168,
		longitud: -3.6938,
		distanciaKm: 2.4,
		precio: 1.479,
		ahorro: 0.02,
		fechaActualizacion: '2026-08-17T10:00:00Z',
	},
	{
		id: 'st-3',
		rotulo: 'Área de servicio Este',
		direccion: 'Carretera M-30, km 12',
		localidad: 'Madrid',
		provincia: 'Madrid',
		latitud: 40.406,
		longitud: -3.6838,
		distanciaKm: 3.8,
		precio: null,
		ahorro: null,
		fechaActualizacion: '2026-08-17T10:00:00Z',
	},
];

const OUTSIDE_DEFAULT_RADIUS = {
	...NEARBY[0],
	id: 'st-outside',
	rotulo: 'Estación fuera del radio',
	latitud: 41.3851,
	longitud: 2.1734,
};

function stubNearby(page: Page, body: unknown) {
	page.route('**/api/stations/nearby*', (route) =>
		route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) }),
	);
}

async function grantLocation(page: Page) {
	await page.context().grantPermissions(['geolocation']);
	await page.context().setGeolocation({ latitude: 40.4168, longitude: -3.7038 });
}

test.describe('filtro de combustible — buscar, comparar y ver detalle', () => {
	test('la lista muestra precios, ahorro, mejor opción y precio no disponible', async ({ page }) => {
		stubNearby(page, NEARBY);
		await grantLocation(page);
		await page.goto('/');
		await expect(page.getByRole('button', { name: 'Acercar mapa' })).toBeVisible();

		await page.getByRole('button', { name: 'Usar mi ubicación' }).click();

		await expect(page.getByRole('listitem')).toHaveCount(3);
		await expect(page.getByRole('heading', { name: 'REPSOL Norte' })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'CEPSA Centro' })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Área de servicio Este' })).toBeVisible();
		await expect(page.locator('.station-card').first()).toHaveCSS('content-visibility', 'auto');

		// La tarjeta destacada lleva la etiqueta de mejor opción.
		await expect(page.locator('.station-card__tag')).toHaveText('Mejor opción');
		await expect(page.getByText('Cuesta 0,020 €/l más que la mejor opción')).toBeVisible();

		// Una estación sin ese combustible muestra el precio como no disponible.
		await expect(page.getByText('Precio no disponible')).toBeVisible();

		// El contador de resultados refleja la consulta.
		await expect(page.locator('.explorer__list-title .explorer__result-count')).toHaveText('3');

		// El mapa recibe los resultados en su fuente nativa y desaparece el vacío.
		await expect(page.getByText('No hay estaciones que mostrar en el mapa.')).not.toBeVisible();
		await expect(page.locator('.vector-map')).toHaveAttribute('data-station-count', '3');
		await expect(page.locator('.vector-map')).toHaveAttribute('data-marker-renderer', 'maplibre-native');
	});

	test('los clústeres se renderizan en WebGL y no reconstruyen nodos HTML al hacer zoom', async ({ page }) => {
		stubNearby(page, [
			NEARBY[0],
			{ ...NEARBY[1], latitud: 40.4261, longitud: -3.7039 },
		]);
		await page.goto('/');

		const map = page.locator('.vector-map');
		await expect(map).toHaveAttribute('data-station-count', '2');
		await expect(page.locator('.station-cluster, .station-marker')).toHaveCount(0);
		await page.getByRole('button', { name: 'Acercar mapa' }).click();
		await page.getByRole('button', { name: 'Acercar mapa' }).click();
		await expect(map).toHaveAttribute('data-station-count', '2');
		await expect(page.locator('.station-cluster, .station-marker')).toHaveCount(0);
	});

	test('cambiar de combustible vuelve a consultar y se refleja en la URL', async ({ page }) => {
		const requests: string[] = [];
		page.route('**/api/stations/nearby*', (route) => {
			requests.push(route.request().url());
			route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(NEARBY) });
		});
		await grantLocation(page);
		await page.goto('/');
		await expect(page.getByRole('button', { name: 'Acercar mapa' })).toBeVisible();

		// Compartir la ubicación activa el radio (10 km por defecto) y consulta
		// una sola vez con el radio.
		await page.getByRole('button', { name: 'Usar mi ubicación' }).click();
		await expect(page.getByRole('listitem')).toHaveCount(3);
		await expect.poll(() => requests.length).toBe(2);
		expect(requests[1]).toContain('radio=10');
		expect(requests[1]).toContain('combustible=DIESEL');

		await page.getByRole('radio', { name: 'Gasolina 98' }).click();

		await expect(page.getByRole('radio', { name: 'Gasolina 98' })).toHaveAttribute(
			'aria-checked',
			'true',
		);
		await expect(page.getByRole('listitem')).toHaveCount(3);
		await expect.poll(() => requests.length).toBe(3);
		expect(requests[2]).toContain('combustible=GASOLINA_98');
		expect(new URL(page.url()).searchParams.get('combustible')).toBe('GASOLINA_98');
	});

	test('recargar conserva el combustible elegido desde la URL', async ({ page }) => {
		stubNearby(page, NEARBY);
		await page.goto('/?combustible=GASOLINA_95');

		await expect(page.getByRole('radio', { name: 'Gasolina 95' })).toHaveAttribute(
			'aria-checked',
			'true',
		);
		await expect(page.getByRole('radio', { name: 'Diésel' })).toHaveAttribute(
			'aria-checked',
			'false',
		);

		await page.reload();

		await expect(page.getByRole('radio', { name: 'Gasolina 95' })).toHaveAttribute(
			'aria-checked',
			'true',
		);
	});

	test('compartir la ubicación activa el radio: elegir km y volver al área visible', async ({
		page,
	}) => {
		const requests: string[] = [];
		const firstRadioResponse: { release?: () => void } = {};
		page.route('**/api/stations/nearby*', async (route) => {
			const url = route.request().url();
			requests.push(url);
			const isRadioRequest = new URL(url).searchParams.has('radio');
			if (isRadioRequest && firstRadioResponse.release === undefined) {
				await new Promise<void>((resolve) => { firstRadioResponse.release = resolve; });
			}
			route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify(isRadioRequest ? NEARBY : [...NEARBY, OUTSIDE_DEFAULT_RADIUS]),
			});
		});
		await grantLocation(page);
		await page.goto('/');
		await expect(page.getByRole('button', { name: 'Acercar mapa' })).toBeVisible();

		// Al cargar se consulta el área visible del mapa (sin ubicación aún).
		await expect(page.getByRole('listitem')).toHaveCount(4);
		await expect.poll(() => requests.length).toBe(1);
		expect(requests[0]).not.toContain('radio=');
		expect(requests[0]).toContain('minLat=');
		expect(requests[0]).toContain('maxLat=');

		// Sin ubicación el interruptor está deshabilitado.
		await expect(page.getByRole('radio', { name: 'Radio de búsqueda' })).toBeDisabled();

		// Compartir la ubicación habilita y activa el radio (10 km por defecto),
		// que ya marca la circunferencia y consulta con el radio.
		await page.getByRole('button', { name: 'Usar mi ubicación' }).click();
		await expect(page.getByRole('radio', { name: 'Radio de búsqueda' })).toHaveAttribute(
			'aria-checked',
			'true',
		);
		await expect(page.getByRole('radio', { name: '10 km' })).toHaveAttribute(
			'aria-checked',
			'true',
		);
		await expect.poll(() => requests.length).toBe(2);
		expect(requests[1]).toContain('radio=10');
		const map = page.locator('.vector-map');
		// El mapa debe excluir la estación lejana en el mismo render que recibe
		// la ubicación, antes incluso de que responda la primera petición por radio.
		await expect(map).toHaveAttribute('data-station-count', '3');
		await expect(map).toHaveAttribute('data-radius-km', '10');
		await expect(map).toHaveAttribute('data-radius-rendered', 'true');
		expect(firstRadioResponse.release).toBeDefined();
		firstRadioResponse.release?.();
		await expect(page.getByRole('listitem')).toHaveCount(3);
		await expect.poll(async () => Number(await map.getAttribute('data-map-zoom'))).toBeLessThan(15);
		await expect.poll(async () => Number(await map.getAttribute('data-map-zoom'))).toBeGreaterThan(10);
		const tenKmZoom = Number(await map.getAttribute('data-map-zoom'));

		// Elegir 50 km vuelve a consultar con el nuevo valor.
		await page.getByRole('radio', { name: '50 km' }).click();
		await expect(page.getByRole('radio', { name: '50 km' })).toHaveAttribute(
			'aria-checked',
			'true',
		);
		await expect.poll(() => requests.length).toBe(3);
		expect(requests[2]).toContain('radio=50');
		await expect(map).toHaveAttribute('data-radius-km', '50');
		await expect(map).toHaveAttribute('data-radius-rendered', 'true');
		await expect.poll(async () => Number(await map.getAttribute('data-map-zoom'))).toBeLessThan(tenKmZoom);

		// Volver al área visible vuelve al viewport y
		// elimina la circunferencia.
		await page.getByRole('radio', { name: 'Área visible en el mapa' }).click();
		await expect(page.getByRole('radio', { name: 'Área visible en el mapa' })).toHaveAttribute(
			'aria-checked',
			'true',
		);
		await expect(page.getByRole('radio', { name: '10 km' })).toHaveCount(0);
		await expect.poll(() => requests.length).toBeGreaterThanOrEqual(4);
		const finalRequest = requests.at(-1) as string;
		expect(finalRequest).not.toContain('radio=');
		expect(finalRequest).toContain('minLat=');
		await expect(map).not.toHaveAttribute('data-radius-km');
		await expect(map).not.toHaveAttribute('data-radius-rendered');
	});

	test('no persiste ni restaura el radio desde la URL', async ({ page }) => {
		stubNearby(page, NEARBY);
		await page.goto('/?radio=25');

		await expect(page.getByRole('radio', { name: 'Área visible en el mapa' })).toHaveAttribute(
			'aria-checked',
			'true',
		);
		await expect(page.getByRole('radio', { name: 'Radio de búsqueda' })).toBeDisabled();
		await expect(page.getByRole('radio', { name: '25 km', exact: true })).toHaveCount(0);
		await expect.poll(() => new URL(page.url()).searchParams.get('radio')).toBeNull();

		await page.reload();

		await expect(page.getByRole('radio', { name: 'Área visible en el mapa' })).toHaveAttribute(
			'aria-checked',
			'true',
		);
		await expect(page.getByRole('radio', { name: 'Radio de búsqueda' })).toBeDisabled();
		await expect(page.getByRole('radio', { name: 'Más cercano' })).toBeDisabled();
	});

	test('la búsqueda manual marca el punto de referencia sin estilo de dispositivo', async ({
		page,
	}) => {
		stubNearby(page, NEARBY);
		page.route('**/api/geocode/search*', (route) =>
			route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify([
					{
						id: 'madrid',
						label: 'Madrid',
						fullName: 'Madrid, Comunidad de Madrid, España',
						tipo: 'municipio',
						latitud: 40.4168,
						longitud: -3.7038,
					},
				]),
			}),
		);
		await page.goto('/');
		await expect(page.getByRole('button', { name: 'Acercar mapa' })).toBeVisible();

		const search = page.getByRole('combobox', { name: 'Ubicación' });
		await search.fill('madrid');
		await expect(page.getByRole('option', { name: /Madrid/ }).first()).toBeVisible();
		await page.keyboard.press('ArrowDown');
		await page.keyboard.press('Enter');

		await expect(
			page.getByRole('status').filter({ hasText: 'Gasolineras actualizadas a Madrid.' }),
		).toHaveText('Gasolineras actualizadas a Madrid.');
		await expect(page.locator('.location-marker:not(.location-marker--device)')).toBeVisible();
		await expect(page.locator('.location-marker--device')).not.toBeVisible();
	});

	test('sin gasolineras en el radio muestra el estado vacío con el combustible', async ({
		page,
	}) => {
		stubNearby(page, []);
		await grantLocation(page);
		await page.goto('/');
		await expect(page.getByRole('button', { name: 'Acercar mapa' })).toBeVisible();

		await page.getByRole('button', { name: 'Usar mi ubicación' }).click();

		await expect(
			page.getByRole('status').filter({ hasText: 'No hay gasolineras con precios de Diésel' }),
		).toBeVisible();
		await expect(page.locator('.explorer__list-title .explorer__result-count')).toHaveText('0');
	});

	test('un fallo del backend de cercanía ofrece reintentar', async ({ page }) => {
		let fail = true;
		page.route('**/api/stations/nearby*', (route) => {
			if (fail) {
				return route.fulfill({ status: 503, body: '{}' });
			}
			return route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify(NEARBY),
			});
		});
		await grantLocation(page);
		await page.goto('/');
		await expect(page.getByRole('button', { name: 'Acercar mapa' })).toBeVisible();

		// La carga inicial consulta el viewport y falla; los reintentos
		// automáticos del mapa siguen fallando mientras `fail` esté activo.
		const alert = page.getByRole('alert').filter({ hasText: 'No se pudieron cargar las gasolineras' });
		await expect(alert).toBeVisible();

		fail = false;
		await page.getByRole('button', { name: 'Reintentar' }).click();

		await expect(page.getByRole('listitem')).toHaveCount(3);
	});

	test('ordenar por cercanía requiere una ubicación marcada', async ({ page }) => {
		const requests: string[] = [];
		page.route('**/api/stations/nearby*', (route) => {
			requests.push(route.request().url());
			route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(NEARBY) });
		});
		await page.goto('/');
		await expect(page.getByRole('button', { name: 'Acercar mapa' })).toBeVisible();

		// Sin ubicación, la cercanía está bloqueada y el orden es el precio.
		await expect(page.getByRole('radio', { name: 'Más barato' })).toHaveAttribute(
			'aria-checked',
			'true',
		);
		await expect(page.getByRole('radio', { name: 'Más cercano' })).toBeDisabled();
		await expect.poll(() => requests.length).toBe(1);
		expect(requests[0]).toContain('orden=precio');

		// Al marcar la ubicación se habilita y ordenar por cercanía consulta
		// con el criterio.
		await grantLocation(page);
		await page.getByRole('button', { name: 'Usar mi ubicación' }).click();
		await expect(page.getByRole('radio', { name: 'Más cercano' })).toBeEnabled();

		await expect
			.poll(async () => {
				await page.getByRole('radio', { name: 'Más cercano' }).click();
				return page
					.getByRole('radio', { name: 'Más cercano' })
					.getAttribute('aria-checked');
			})
			.toBe('true');

		await expect(page.getByRole('listitem')).toHaveCount(3);
		await expect.poll(() => requests.at(-1)!.includes('orden=distancia')).toBe(true);
		expect(new URL(page.url()).searchParams.get('orden')).toBe('distancia');
	});

	test('sin ubicación, recargar con orden por cercanía fuerza el precio', async ({ page }) => {
		stubNearby(page, NEARBY);
		await page.goto('/?orden=distancia');
		// Se espera a la hidratación de la isla para que el filtro lea la URL
		// y deje la URL consistente antes de comprobar el resultado.
		await expect(page.getByRole('button', { name: 'Acercar mapa' })).toBeVisible();

		await expect(page.getByRole('radio', { name: 'Más barato' })).toHaveAttribute(
			'aria-checked',
			'true',
		);
		await expect(page.getByRole('radio', { name: 'Más cercano' })).toBeDisabled();
		await expect.poll(() => new URL(page.url()).searchParams.get('orden')).toBe('precio');
	});

	test('el anillo de foco aparece al navegar los chips con teclado', async ({ page }) => {
		await page.goto('/');
		// Se espera a la hidratación de la isla (el mapa solo existe tras
		// hidratarse) para que los manejadores de teclado estén activos.
		await expect(page.getByRole('button', { name: 'Acercar mapa' })).toBeVisible();

		const diesel = page.getByRole('radio', { name: 'Diésel' });
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

		const gasoline95 = page.getByRole('radio', { name: 'Gasolina 95' });
		await expect(gasoline95).toHaveCSS('outline-style', 'none');
		const shadow = await gasoline95.evaluate((el) => getComputedStyle(el).boxShadow);
		expect(shadow).not.toBe('none');
	});

	test('añadir una gasolinera al panel de comparar y abrir su ficha', async ({
		page,
		isMobile,
	}) => {
		test.skip(isMobile, 'el comparador solo existe en escritorio');
		stubNearby(page, NEARBY);
		page.route('**/api/stations/st-1', (route) =>
			route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					id: 'st-1',
					rotulo: 'REPSOL Norte',
					direccion: 'Av. de la Industria, 24',
					codigoPostal: '28001',
					localidad: 'Madrid',
					municipio: 'Madrid',
					provincia: 'Madrid',
					latitud: 40.426,
					longitud: -3.7038,
					horario: 'L-D: 06:00-22:00',
					tipoVenta: 'P',
					margen: 'D',
					precios: { DIESEL: 1.459, GASOLINA_95: 1.599, GASOLINA_98: 1.699 },
					fechaActualizacion: '2026-08-18T10:00:00Z',
				}),
			}),
		);
		await page.goto('/');
		await expect(page.getByRole('button', { name: 'Acercar mapa' })).toBeVisible();

		// Al principio no hay columna de comparar.
		await expect(page.getByRole('heading', { name: 'Comparar' })).toHaveCount(0);

		// El caso problemático ocurría al añadir desde el zoom mínimo del mapa.
		// Llegamos al mínimo con el control real, como lo haría un usuario.
		for (let step = 0; step < 30; step += 1) {
			const zoomOut = page.getByRole('button', { name: 'Alejar mapa' });
			if (await zoomOut.isDisabled()) break;
			await zoomOut.click();
		}

		// Clic en una gasolinera: despliega las acciones y se añade al comparador.
		await page.getByRole('heading', { name: 'REPSOL Norte' }).click();
		await page.getByRole('button', { name: 'Añadir al comparador' }).click();

		const comparar = page.getByRole('complementary', { name: 'Gasolineras para comparar' });
		await expect(comparar).toBeVisible();
		await expect(comparar.getByRole('heading', { name: 'Comparar' })).toBeVisible();
		await expect(comparar.getByText('1 gasolinera')).toBeVisible();
		await expect(comparar.getByText('1,459 €/l')).toBeVisible();

		// La aparición del comparador no debe dejar el mapa bloqueado.
		await page.getByRole('button', { name: 'Acercar mapa' }).click();

		// La ficha se abre desde el panel con «Ver ficha».
		await comparar.getByRole('button', { name: 'Ver ficha' }).click();

		const ficha = page.getByRole('dialog', { name: 'Ficha de la gasolinera' });
		await expect(ficha).toBeVisible();
		await expect(ficha.getByText('L-D: 06:00-22:00')).toBeVisible();
		await expect(ficha.getByText('1,459 €/l')).toBeVisible();
		await expect(ficha.getByRole('link', { name: /Cómo llegar/ })).toBeVisible();

		await page.getByRole('button', { name: 'Cerrar ficha' }).click();
		await expect(ficha).not.toBeVisible();

		// Quitar la gasolinera oculta la columna de comparar.
		await comparar.getByRole('button', { name: 'Quitar REPSOL Norte' }).click();
		await expect(comparar).not.toBeVisible();
	});

	test('en móvil, tocar una tarjeta abre la ficha directamente', async ({ page, isMobile }) => {
		test.skip(!isMobile, 'comportamiento de móvil');
		stubNearby(page, NEARBY);
		page.route('**/api/stations/st-1', (route) =>
			route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					id: 'st-1',
					rotulo: 'REPSOL Norte',
					direccion: 'Av. de la Industria, 24',
					codigoPostal: '28001',
					localidad: 'Madrid',
					municipio: 'Madrid',
					provincia: 'Madrid',
					latitud: 40.426,
					longitud: -3.7038,
					horario: 'L-D: 06:00-22:00',
					tipoVenta: 'P',
					margen: 'D',
					precios: { DIESEL: 1.459, GASOLINA_95: 1.599, GASOLINA_98: 1.699 },
					fechaActualizacion: '2026-08-18T10:00:00Z',
				}),
			}),
		);
		await page.goto('/');
		await expect(page.getByRole('button', { name: 'Acercar mapa' })).toBeVisible();
		await page.setViewportSize({ width: 915, height: 412 });

		// En móvil no hay columna de comparar.
		await expect(page.getByRole('heading', { name: 'Comparar' })).toHaveCount(0);

		// El tap abre la ficha de la estación sin pasar por el comparador.
		await page.getByRole('heading', { name: 'REPSOL Norte' }).click();

		const ficha = page.getByRole('dialog', { name: 'Ficha de la gasolinera' });
		await expect(ficha).toBeVisible();
		await expect(ficha.getByText('L-D: 06:00-22:00')).toBeVisible();
		await expect(ficha.getByText('1,459 €/l')).toBeVisible();

		await page.getByRole('button', { name: 'Cerrar ficha' }).click();
		await expect(ficha).not.toBeVisible();
	});

	test('en móvil, el panel desplaza su contenido hasta el final de la lista', async ({
		page,
		isMobile,
	}) => {
		test.skip(!isMobile, 'hoja inferior de móvil');
		const manyStations = Array.from({ length: 15 }, (_, i) => ({
			id: `st-${100 + i}`,
			rotulo: `Gasolinera ${i + 1}`,
			direccion: `Calle ${i + 1}, 1`,
			localidad: 'Madrid',
			provincia: 'Madrid',
			latitud: 40.4168 + i * 0.001,
			longitud: -3.7038 + i * 0.001,
			distanciaKm: 1 + i,
			precio: 1.45 + i * 0.01,
			ahorro: i * 0.01,
			fechaActualizacion: '2026-08-17T10:00:00Z',
		}));
		stubNearby(page, manyStations);
		await grantLocation(page);
		await page.goto('/');
		await expect(page.getByRole('button', { name: 'Acercar mapa' })).toBeVisible();

		await page.getByRole('button', { name: 'Usar mi ubicación' }).click();
		await expect(page.getByRole('listitem').first()).toBeVisible();

		// El contenido desborda la hoja: es el contenedor que se desplaza
		// (el resumen queda fijo arriba).
		const content = page.locator('.explorer__sidebar-content');
		await expect
			.poll(() => content.evaluate((el) => el.scrollHeight > el.clientHeight))
			.toBe(true);

		// La rueda sobre el contenido avanza su scroll (no el del details).
		await expect
			.poll(
				async () => {
					const box = await content.boundingBox();
					if (!box) return false;
					await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
					await page.mouse.wheel(0, 600);
					return content.evaluate((el) => el.scrollTop > 0);
				},
				{ timeout: 15_000 },
			)
			.toBe(true);

		// Se llega al fondo de la lista.
		await expect
			.poll(
				async () => {
					const box = await content.boundingBox();
					if (!box) return false;
					await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
					await page.mouse.wheel(0, 600);
					return content.evaluate(
						(el) => el.scrollTop + el.clientHeight >= el.scrollHeight - 1,
					);
				},
				{ timeout: 15_000 },
			)
			.toBe(true);
	});

	test('el enlace de la landing aterriza en el radio 10 km con su circunferencia', async ({
		page,
	}) => {
		const requests: string[] = [];
		page.route('**/api/stations/nearby*', (route) => {
			requests.push(route.request().url());
			route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(NEARBY) });
		});
		await page.goto('/?lugar=Bilbao&lat=43.25696&lon=-2.923441');
		await expect(page.getByRole('button', { name: 'Acercar mapa' })).toBeVisible();

		// El deep-link activa el radio de búsqueda a 10 km alrededor de Bilbao.
		await expect(page.getByRole('radio', { name: 'Radio de búsqueda' })).toHaveAttribute(
			'aria-checked',
			'true',
		);
		await expect(page.getByRole('radio', { name: '10 km' })).toHaveAttribute('aria-checked', 'true');
		await expect(page.getByRole('listitem')).toHaveCount(3);

		// Al menos una consulta se acota por radio de 10 km (no por el viewport
		// de toda España que emite el mapa al hidratarse).
		await expect.poll(() => requests.some((url) => url.includes('radio=10'))).toBe(true);

		// La circunferencia del radio queda dibujada sobre el mapa.
		await expect(page.locator('.vector-map')).toHaveAttribute('data-radius-km', '10');
		await expect(page.locator('.vector-map')).toHaveAttribute('data-radius-rendered', 'true');
	});

	test('flujo MVP completo: buscar, filtrar, ordenar, abrir ficha e indicaciones', async ({
		page,
		isMobile,
	}) => {
		stubNearby(page, NEARBY);
		page.route('**/api/stations/st-1', (route) =>
			route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					id: 'st-1',
					rotulo: 'REPSOL Norte',
					direccion: 'Av. de la Industria, 24',
					codigoPostal: '28001',
					localidad: 'Madrid',
					municipio: 'Madrid',
					provincia: 'Madrid',
					latitud: 40.426,
					longitud: -3.7038,
					horario: 'L-D: 06:00-22:00',
					tipoVenta: 'P',
					margen: 'D',
					precios: { DIESEL: 1.459, GASOLINA_95: 1.599, GASOLINA_98: 1.699 },
					fechaActualizacion: '2026-08-18T10:00:00Z',
				}),
			}),
		);
		page.route('**/api/geocode/search*', (route) =>
			route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify([
					{
						id: 'madrid',
						label: 'Madrid',
						fullName: 'Madrid, Comunidad de Madrid, España',
						tipo: 'municipio',
						latitud: 40.4168,
						longitud: -3.7038,
					},
				]),
			}),
		);
		await page.goto('/');
		await expect(page.getByRole('button', { name: 'Acercar mapa' })).toBeVisible();

		// 1) Búsqueda manual por ciudad.
		const search = page.getByRole('combobox', { name: 'Ubicación' });
		await search.fill('madrid');
		await expect(page.getByRole('option', { name: /Madrid/ }).first()).toBeVisible();
		await page.keyboard.press('Enter');
		await expect(
			page.getByRole('status').filter({ hasText: 'Gasolineras actualizadas a Madrid.' }),
		).toHaveText('Gasolineras actualizadas a Madrid.');

		// 2) Filtro de combustible.
		await page.getByRole('radio', { name: 'Gasolina 95' }).click();
		await expect(page.locator('.explorer__list-title .explorer__result-count')).toHaveText('3');

		// 3) Ordenación.
		await page.getByRole('radio', { name: 'Más cercano' }).click();
		expect(new URL(page.url()).searchParams.get('orden')).toBe('distancia');

		// 4) Añadir la gasolinera al panel de comparar y abrir su ficha. En
		// móvil no hay comparador: el tap abre la ficha directamente.
		await page.getByRole('heading', { name: 'REPSOL Norte' }).click();
		const ficha = page.getByRole('dialog', { name: 'Ficha de la gasolinera' });
		if (isMobile) {
			await expect(ficha).toBeVisible();
			await expect(ficha.getByText('1,459 €/l')).toBeVisible();
		} else {
			await page.getByRole('button', { name: 'Añadir al comparador' }).click();
			const comparar = page.getByRole('complementary', { name: 'Gasolineras para comparar' });
			await expect(comparar).toBeVisible();
			await comparar.getByRole('button', { name: 'Ver ficha' }).click();
		}
		await expect(ficha).toBeVisible();
		await expect(ficha.getByText('1,459 €/l')).toBeVisible();

		// 5) Indicaciones a Google Maps.
		const direcciones = ficha.getByRole('link', { name: /Cómo llegar/ });
		await expect(direcciones).toBeVisible();
		await expect(direcciones).toHaveAttribute(
			'href',
			'https://www.google.com/maps/dir/?api=1&destination=40.426,-3.7038&travelmode=driving',
		);
	});
});
