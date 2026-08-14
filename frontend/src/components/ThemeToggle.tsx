import { useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

const THEME_STORAGE_KEY = 'gasolineras-theme';

function getSystemTheme(): Theme {
	return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export default function ThemeToggle() {
	const [theme, setTheme] = useState<Theme>('light');

	useEffect(() => {
		let savedTheme: string | null = null;
		try {
			savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
		} catch {
			// Se mantiene la preferencia del sistema si el almacenamiento no está disponible.
		}
		const initialTheme: Theme = savedTheme === 'dark' || savedTheme === 'light'
			? savedTheme
			: getSystemTheme();

		document.documentElement.dataset.theme = initialTheme;
		setTheme(initialTheme);
	}, []);

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
