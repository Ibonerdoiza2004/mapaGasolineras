import { useCallback, useEffect, useRef, useState, type SyntheticEvent } from 'react';

import { dispatchMarcasChange } from '../lib/explorerEvents';
import { fetchBrands, type Brand } from '../lib/stations';
import { getUrlParam, setUrlParam } from '../lib/urlState';

const MARCAS_URL_PARAM = 'marcas';

function readMarcasFromUrl(): string[] {
	const value = getUrlParam(MARCAS_URL_PARAM);
	if (!value) return [];
	return value
		.split(',')
		.map((code) => code.trim())
		.filter((code) => code.length > 0);
}

/**
 * Filtro por marca en un acordeón plegado por defecto. El catálogo (con
 * conteos) se consulta al backend; cada marca es una casilla y la selección
 * se refleja en la URL y se notifica con `gasolineras:marcas`. Si el backend
 * no responde, el filtro se oculta sin bloquear la búsqueda.
 */
export default function BrandFilter() {
	const [brands, setBrands] = useState<Brand[]>([]);
	const [selected, setSelected] = useState<string[]>([]);
	const [query, setQuery] = useState('');
	const [announcement, setAnnouncement] = useState('');
	const selectedRef = useRef(selected);
	selectedRef.current = selected;

	useEffect(() => {
		let cancelled = false;
		fetchBrands()
			.then((catalog) => {
				if (cancelled || catalog.length === 0) return;
				setBrands(catalog);
				// Se conserva la selección de la URL solo si sus códigos siguen
				// en el catálogo (p. ej. tras cambiar el proveedor de datos).
				const codes = new Set(catalog.map((brand) => brand.code));
				const restored = readMarcasFromUrl().filter((code) => codes.has(code));
				selectedRef.current = restored;
				setSelected(restored);
				dispatchMarcasChange(restored);
			})
			.catch(() => {
				// Sin catálogo no hay filtro: se deja vacío y se oculta.
			});
		return () => {
			cancelled = true;
		};
	}, []);

	// Al abrir el acordeón se refrescan los conteos: el catálogo puede cambiar
	// tras una importación o el re-etiquetado de estaciones, y así el desplegable
	// nunca muestra cifras de la primera carga.
	const refreshCounts = useCallback(() => {
		fetchBrands()
			.then((catalog) => {
				if (catalog.length > 0) setBrands(catalog);
			})
			.catch(() => {});
	}, []);

	const handleToggle = useCallback(
		(event: SyntheticEvent<HTMLDetailsElement>) => {
			if (event.currentTarget.open) refreshCounts();
		},
		[refreshCounts],
	);

	const toggle = useCallback((code: string) => {
		const next = selectedRef.current.includes(code)
			? selectedRef.current.filter((item) => item !== code)
			: [...selectedRef.current, code];
		selectedRef.current = next;
		setSelected(next);
		setUrlParam(MARCAS_URL_PARAM, next.length > 0 ? next.join(',') : null);
		dispatchMarcasChange(next);
		const label = brands.find((brand) => brand.code === code)?.label ?? code;
		setAnnouncement(
			next.includes(code)
				? `Filtro por marca: ${label}`
				: `Filtro por marca: ${label} desactivado`,
		);
	}, [brands]);

	if (brands.length === 0) return null;

	const activeCount = selected.length;
	const normalizedQuery = query.trim().toLocaleLowerCase();
	const visibleBrands =
		normalizedQuery.length === 0
			? brands
			: brands.filter((brand) =>
					brand.label.toLocaleLowerCase().includes(normalizedQuery),
				);

	return (
		<details className="explorer__brand-filter" onToggle={handleToggle}>
			<summary>
				<span className="explorer__brand-filter-title">Filtrar por marca</span>
				{activeCount > 0 && (
					<span className="explorer__brand-filter-count" aria-label={`${activeCount} marcas activas`}>
						{activeCount}
					</span>
				)}
			</summary>
			<div className="explorer__brand-search-wrap">
				<input
					type="search"
					className="explorer__brand-search"
					placeholder="Buscar marca…"
					aria-label="Buscar marca"
					value={query}
					onChange={(event) => setQuery(event.target.value)}
				/>
			</div>
			{visibleBrands.length === 0 ? (
				<p className="explorer__brand-empty">No hay marcas que coincidan con «{query.trim()}».</p>
			) : (
				<fieldset className="explorer__brand-list">
					<legend className="visually-hidden">Marcas de gasolinera</legend>
					{visibleBrands.map((brand) => {
						const checked = selected.includes(brand.code);
						return (
							<label key={brand.code} className="explorer__brand-option">
								<input
									type="checkbox"
									checked={checked}
									onChange={() => toggle(brand.code)}
								/>
								<span className="explorer__brand-label">{brand.label}</span>
								<span className="explorer__brand-count">{brand.count}</span>
							</label>
						);
					})}
				</fieldset>
			)}
			{announcement && (
				<p className="visually-hidden" role="status">
					{announcement}
				</p>
			)}
		</details>
	);
}