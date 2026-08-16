import { expect, test } from '@playwright/test';

test.describe('lector de pantalla — roles y nombres accesibles', () => {
	test('expone los roles y nombres de los controles principales', async ({ page }) => {
		await page.goto('/');

		await expect(page.getByRole('banner')).toBeVisible();
		await expect(page.getByRole('navigation', { name: 'Navegación principal' })).toBeVisible();
		await expect(page.getByRole('main')).toBeVisible();
		await expect(page.getByRole('region', { name: 'Mapa de gasolineras cercanas' })).toBeVisible();

		await expect(page.getByRole('searchbox', { name: 'Ubicación' })).toBeVisible();
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

		const expected = [
			['link', 'Mapa de Gasolineras, inicio'],
			['link', 'Explorar'],
			['link', 'Rutas'],
			['button', 'Activar modo oscuro'],
			['searchbox', 'Ubicación'],
			['combobox', 'Combustible'],
			['combobox', 'Radio'],
			['button', 'Usar mi ubicación'],
			['combobox', 'Ordenar resultados'],
			['button', 'Acercar mapa'],
			['button', 'Alejar mapa'],
		] as const;

		for (const [role, name] of expected) {
			await page.keyboard.press('Tab');
			await expect(page.getByRole(role, { name })).toBeFocused();
		}
	});

	test('el selector de tema se activa con el teclado', async ({ page }) => {
		await page.goto('/');

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
