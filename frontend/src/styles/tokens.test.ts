import { afterEach, describe, expect, it } from 'vitest';

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const tokensCss = readFileSync(resolve(process.cwd(), 'src/styles/tokens.css'), 'utf8');
const darkThemeStart = tokensCss.indexOf(':root[data-theme="dark"]');
const mediaQueryStart = tokensCss.indexOf('@media (prefers-color-scheme: dark)');
const themeCss = {
	light: tokensCss.slice(0, darkThemeStart),
	dark: tokensCss.slice(darkThemeStart, mediaQueryStart),
};

function channel(value: string) {
	const normalized = Number.parseInt(value, 16) / 255;
	return normalized <= 0.03928
		? normalized / 12.92
		: ((normalized + 0.055) / 1.055) ** 2.4;
}

function luminance(color: string) {
	const [red, green, blue] = color
		.slice(1)
		.match(/.{2}/g)!
		.map(channel);
	return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrastRatio(foreground: string, background: string) {
	const foregroundLuminance = luminance(foreground);
	const backgroundLuminance = luminance(background);
	const lighter = Math.max(foregroundLuminance, backgroundLuminance);
	const darker = Math.min(foregroundLuminance, backgroundLuminance);
	return (lighter + 0.05) / (darker + 0.05);
}

function token(theme: keyof typeof themeCss, name: string) {
	const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	const match = themeCss[theme].match(new RegExp(`${escapedName}:\\s*(#[0-9a-fA-F]{6})`));
	if (!match) throw new Error(`Token no encontrado: ${theme} ${name}`);
	return match[1];
}

function focusRingColor(theme: keyof typeof themeCss) {
	const match = themeCss[theme].match(
		/--focus-ring:\s*0 0 0 \d+px rgb\((\d+)\s+(\d+)\s+(\d+)\)/,
	);
	if (!match) throw new Error(`Anillo de foco no encontrado: ${theme}`);
	const [red, green, blue] = [match[1], match[2], match[3]].map((value) =>
		Number.parseInt(value, 10),
	);
	return `#${[red, green, blue]
		.map((value) => value.toString(16).padStart(2, '0'))
		.join('')}`;
}

const AA_TEXT_PAIRS: Array<[string, string]> = [
	['--color-text', '--color-page'],
	['--color-text', '--color-surface'],
	['--color-text', '--color-surface-muted'],
	['--color-text', '--color-surface-emphasis'],
	['--color-text-muted', '--color-page'],
	['--color-text-muted', '--color-surface'],
	['--color-text-muted', '--color-surface-muted'],
	['--color-text-muted', '--color-surface-emphasis'],
	['--color-brand-900', '--color-page'],
	['--color-brand-900', '--color-surface'],
	['--color-brand-900', '--color-surface-emphasis'],
	['--color-brand-700', '--color-page'],
	['--color-brand-700', '--color-surface'],
	['--color-text-on-brand', '--color-brand-700'],
	['--color-text-on-brand', '--color-brand-900'],
	['--color-success', '--color-success-surface'],
	['--color-warning', '--color-warning-surface'],
	['--color-danger', '--color-danger-surface'],
	['--color-text', '--color-danger-surface'],
	['--color-text', '--color-warning-surface'],
	['--color-text', '--color-success-surface'],
];

const UI_PAIRS: Array<[string, string]> = [
	['--color-border', '--color-page'],
	['--color-border', '--color-surface'],
	['--color-border', '--color-surface-muted'],
	['--color-border', '--color-surface-emphasis'],
	['--color-border-strong', '--color-page'],
	['--color-border-strong', '--color-surface'],
	['--color-border-strong', '--color-surface-muted'],
	['--color-border-strong', '--color-surface-emphasis'],
];

describe('tokens visuales', () => {
	afterEach(() => {
		document.documentElement.removeAttribute('data-theme');
	});

	it.each([
		['light', '#ffffff', '#17232d'],
		['dark', '#24282b', '#f3f5f6'],
	])('define superficies y texto para el tema %s', (theme, page, text) => {
		expect(token(theme as keyof typeof themeCss, '--color-page')).toBe(page);
		expect(token(theme as keyof typeof themeCss, '--color-text')).toBe(text);
	});

	it.each(
		(['light', 'dark'] as const).flatMap((theme) =>
			AA_TEXT_PAIRS.map(([foreground, background]) => [theme, foreground, background] as const),
		),
	)('mantiene contraste de texto AA (4.5:1) en %s entre %s y %s', (theme, foreground, background) => {
		expect(
			contrastRatio(token(theme, foreground), token(theme, background)),
		).toBeGreaterThanOrEqual(4.5);
	});

	it.each(
		(['light', 'dark'] as const).flatMap((theme) =>
			UI_PAIRS.map(([foreground, background]) => [theme, foreground, background] as const),
		),
	)('mantiene contraste no textual (3:1) en %s entre %s y %s', (theme, foreground, background) => {
		expect(
			contrastRatio(token(theme, foreground), token(theme, background)),
		).toBeGreaterThanOrEqual(3);
	});

	it.each([
		['light', '--color-diesel'],
		['light', '--color-gasoline-95'],
		['light', '--color-gasoline-98'],
		['dark', '--color-diesel'],
		['dark', '--color-gasoline-95'],
		['dark', '--color-gasoline-98'],
	])('mantiene contraste no textual (3:1) del combustible %s sobre la superficie', (theme, color) => {
		const selectedTheme = theme as keyof typeof themeCss;
		expect(
			contrastRatio(token(selectedTheme, color), token(selectedTheme, '--color-surface')),
		).toBeGreaterThanOrEqual(3);
	});

	it.each(['light', 'dark'] as const)(
		'define el anillo de foco con color sólido en el tema %s',
		(theme) => {
			expect(themeCss[theme]).toMatch(/--focus-ring:\s*0 0 0 \d+px rgb\(\d+\s+\d+\s+\d+\)/);
		},
	);

	it.each(
		(['light', 'dark'] as const).flatMap((theme) =>
			(['--color-page', '--color-surface-emphasis'] as const).map(
				(background) => [theme, background] as const,
			),
		),
	)('el anillo de foco mantiene 3:1 sobre %s en el tema %s', (theme, background) => {
		expect(contrastRatio(focusRingColor(theme), token(theme, background))).toBeGreaterThanOrEqual(
			3,
		);
	});
});
