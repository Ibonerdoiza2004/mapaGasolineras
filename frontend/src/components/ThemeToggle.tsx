import { useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

const THEME_STORAGE_KEY = 'gasolineras-theme';

declare global {
	interface Window {
		// Tema resuelto por el script inline de BaseLayout antes de hidratar.
		__gasolinerasTheme?: string;
	}
}

function getSystemTheme(): Theme {
	return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function getInitialTheme(): Theme {
	if (typeof window === 'undefined') {
		return 'light';
	}
	const resolved = window.__gasolinerasTheme;
	if (resolved === 'light' || resolved === 'dark') {
		return resolved;
	}
	let savedTheme: string | null = null;
	try {
		savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
	} catch {
		// Se mantiene la preferencia del sistema si el almacenamiento no está disponible.
	}
	if (savedTheme === 'light' || savedTheme === 'dark') {
		return savedTheme;
	}
	return getSystemTheme();
}

export default function ThemeToggle() {
	const [theme, setTheme] = useState<Theme>(getInitialTheme);

	useEffect(() => {
		document.documentElement.dataset.theme = theme;
	}, [theme]);

	function toggleTheme() {
		const nextTheme: Theme = theme === 'dark' ? 'light' : 'dark';
		document.documentElement.dataset.theme = nextTheme;
		try {
			window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
		} catch {
			// El cambio visual sigue funcionando aunque no pueda persistirse.
		}
		setTheme(nextTheme);
	}

	const nextThemeLabel = theme === 'dark' ? 'Activar modo claro' : 'Activar modo oscuro';

	return (
		<button
			id="theme-toggle"
			className="theme-toggle"
			type="button"
			onClick={toggleTheme}
			aria-label={nextThemeLabel}
			aria-pressed={theme === 'dark'}
			title={nextThemeLabel}
		>
			<span aria-hidden="true">{theme === 'dark' ? '☀' : '☾'}</span>
			<span>{theme === 'dark' ? 'Claro' : 'Oscuro'}</span>
		</button>
	);
}
