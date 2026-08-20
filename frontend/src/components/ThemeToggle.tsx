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
			<span className="theme-toggle__icons" aria-hidden="true">
				<span data-theme-icon="sun">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth={2}
						strokeLinecap="round"
						strokeLinejoin="round"
					>
						<circle cx="12" cy="12" r="4" />
						<path d="M12 2v2" />
						<path d="M12 20v2" />
						<path d="m4.93 4.93 1.41 1.41" />
						<path d="m17.66 17.66 1.41 1.41" />
						<path d="M2 12h2" />
						<path d="M20 12h2" />
						<path d="m6.34 17.66-1.41 1.41" />
						<path d="m19.07 4.93-1.41 1.41" />
					</svg>
				</span>
				<span data-theme-icon="moon">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth={2}
						strokeLinecap="round"
						strokeLinejoin="round"
					>
						<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
					</svg>
				</span>
			</span>
			<span>{theme === 'dark' ? 'Claro' : 'Oscuro'}</span>
		</button>
	);
}
