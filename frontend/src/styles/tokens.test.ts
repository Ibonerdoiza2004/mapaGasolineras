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

describe('tokens visuales', () => {
	afterEach(() => {
		document.documentElement.removeAttribute('data-theme');
	});

	it.each([
		['light', '#ffffff', '#17232d'],
		['dark', '#151a1f', '#f1f5f7'],
	])('define superficies y texto para el tema %s', (theme, page, text) => {
		expect(token(theme as keyof typeof themeCss, '--color-page')).toBe(page);
		expect(token(theme as keyof typeof themeCss, '--color-text')).toBe(text);
	});

	it.each([
		['light', '--color-text', '--color-page'],
		['light', '--color-text-muted', '--color-page'],
		['light', '--color-success', '--color-success-surface'],
		['dark', '--color-text', '--color-page'],
		['dark', '--color-text-muted', '--color-page'],
		['dark', '--color-success', '--color-success-surface'],
	])('mantiene contraste AA en %s entre %s y %s', (theme, foreground, background) => {
		const selectedTheme = theme as keyof typeof themeCss;
		expect(
			contrastRatio(token(selectedTheme, foreground), token(selectedTheme, background)),
		).toBeGreaterThanOrEqual(4.5);
	});
});
