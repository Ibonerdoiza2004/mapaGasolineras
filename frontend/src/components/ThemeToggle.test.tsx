import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import ThemeToggle from './ThemeToggle';

const STORAGE_KEY = 'gasolineras-theme';

describe('ThemeToggle', () => {
	beforeEach(() => {
		window.localStorage.clear();
		document.documentElement.removeAttribute('data-theme');
	});

	afterEach(() => {
		cleanup();
		document.documentElement.removeAttribute('data-theme');
	});

	it('usa la preferencia del sistema cuando no hay una preferencia guardada', async () => {
		render(<ThemeToggle />);

		await waitFor(() => {
			expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
		});
		expect(screen.getByRole('button', { name: 'Activar modo claro' })).toBeInTheDocument();
	});

	it('rechaza una preferencia almacenada inválida y vuelve al sistema', async () => {
		window.localStorage.setItem(STORAGE_KEY, 'sepia');

		render(<ThemeToggle />);

		await waitFor(() => {
			expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
		});
		expect(window.localStorage.getItem(STORAGE_KEY)).toBe('sepia');
	});

	it('mantiene el tema del sistema si el almacenamiento no está disponible', async () => {
		vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
			throw new Error('localStorage no disponible');
		});

		render(<ThemeToggle />);

		await waitFor(() => {
			expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
		});
		expect(screen.getByRole('button', { name: 'Activar modo claro' })).toBeInTheDocument();
	});

	it('alterna el tema, actualiza el control y persiste la elección', async () => {
		window.localStorage.setItem(STORAGE_KEY, 'light');
		render(<ThemeToggle />);

		await waitFor(() => {
			expect(document.documentElement).toHaveAttribute('data-theme', 'light');
		});

		const toggle = screen.getByRole('button', { name: 'Activar modo oscuro' });
		expect(toggle).toHaveAttribute('aria-pressed', 'false');

		fireEvent.click(toggle);

		await waitFor(() => {
			expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
			expect(window.localStorage.getItem(STORAGE_KEY)).toBe('dark');
		});
		expect(screen.getByRole('button', { name: 'Activar modo claro' })).toHaveAttribute(
			'aria-pressed',
			'true',
		);
	});

	it('expone un nombre accesible y funciona como botón', async () => {
		render(<ThemeToggle />);

		await waitFor(() => {
			expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
		});
		expect(screen.getByRole('button', { name: 'Activar modo claro' })).toHaveAttribute(
			'type',
			'button',
		);
	});
});
