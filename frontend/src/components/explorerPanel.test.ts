import { afterEach, describe, expect, it } from 'vitest';

import { enhanceExplorerPanel } from './explorerPanel';

function createPanel(open = false) {
	const details = document.createElement('details');
	details.className = 'explorer__sidebar';
	details.open = open;

	const summary = document.createElement('summary');
	summary.textContent = 'Gasolineras cercanas';
	details.appendChild(summary);

	const content = document.createElement('div');
	content.className = 'explorer__sidebar-content';
	details.appendChild(content);

	document.body.appendChild(details);
	return { details, summary, content };
}

function press(target: EventTarget, key: string) {
	target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
}

afterEach(() => {
	document.body.innerHTML = '';
});

describe('enhanceExplorerPanel', () => {
	it('refleja el estado inicial del panel en aria-expanded', () => {
		const closed = createPanel(false);
		enhanceExplorerPanel(closed.details);
		expect(closed.summary).toHaveAttribute('aria-expanded', 'false');

		const opened = createPanel(true);
		enhanceExplorerPanel(opened.details);
		expect(opened.summary).toHaveAttribute('aria-expanded', 'true');
	});

	it('sincroniza aria-expanded cuando cambia el estado open', () => {
		const { details, summary } = createPanel(true);
		enhanceExplorerPanel(details);

		details.open = false;
		details.dispatchEvent(new Event('toggle'));

		expect(summary).toHaveAttribute('aria-expanded', 'false');
	});

	it('Escape cierra el panel abierto y devuelve el foco al resumen', () => {
		const { details, summary } = createPanel(true);
		enhanceExplorerPanel(details);
		summary.focus();

		press(summary, 'Escape');

		expect(details.open).toBe(false);
		expect(summary).toHaveAttribute('aria-expanded', 'false');
		expect(document.activeElement).toBe(summary);
	});

	it('Escape dentro del panel cierra y devuelve el foco al resumen', () => {
		const { details, summary, content } = createPanel(true);
		enhanceExplorerPanel(details);

		press(content, 'Escape');

		expect(details.open).toBe(false);
		expect(document.activeElement).toBe(summary);
	});

	it('Escape dentro de un campo de formulario no cierra el panel', () => {
		const { details, content } = createPanel(true);
		enhanceExplorerPanel(details);

		const input = document.createElement('input');
		input.type = 'search';
		content.appendChild(input);
		input.focus();

		press(input, 'Escape');

		expect(details.open).toBe(true);
	});

	it('Escape no hace nada cuando el panel ya está cerrado', () => {
		const { details, summary } = createPanel(false);
		enhanceExplorerPanel(details);

		press(summary, 'Escape');

		expect(details.open).toBe(false);
		expect(summary).toHaveAttribute('aria-expanded', 'false');
	});

	it('otras teclas no cierran el panel', () => {
		const { details, summary } = createPanel(true);
		enhanceExplorerPanel(details);

		press(summary, 'Enter');
		press(summary, 'a');

		expect(details.open).toBe(true);
	});

	it('la limpieza desactiva los listeners y deja de actualizar el estado', () => {
		const { details, summary } = createPanel(true);
		const cleanup = enhanceExplorerPanel(details);
		cleanup();

		details.open = false;
		details.dispatchEvent(new Event('toggle'));
		press(summary, 'Escape');

		expect(summary).toHaveAttribute('aria-expanded', 'true');
	});

	it('devuelve una función inofensiva si el details no tiene summary', () => {
		const details = document.createElement('details');
		document.body.appendChild(details);

		const cleanup = enhanceExplorerPanel(details);
		expect(() => cleanup()).not.toThrow();
	});
});
