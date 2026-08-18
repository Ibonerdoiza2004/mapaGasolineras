import { useEffect, useRef, useState } from 'react';

import { apiUrl } from '../config/runtime';
import { dispatchUserLocation } from '../lib/geolocation';

interface GeocodeSuggestion {
	id: string;
	label: string;
	fullName: string;
	tipo: string;
	latitud: number;
	longitud: number;
}

type Status = 'idle' | 'loading' | 'open' | 'no-results' | 'error' | 'selected';

export const SEARCH_DEBOUNCE_MS = 350;
export const SEARCH_MIN_LENGTH = 3;
const SEARCH_INPUT_ID = 'explorer-search';
const LISTBOX_ID = 'explorer-search-suggestions';
const PLACEHOLDER = 'Ciudad, dirección o código postal';

const MIN_LENGTH_HINT = 'Escribe al menos 3 caracteres para ver sugerencias.';
const NO_RESULTS_MESSAGE = 'Sin resultados para';
const ERROR_MESSAGE = 'No se pudo buscar ahora. Revisa tu conexión e inténtalo de nuevo.';

/**
 * Buscador de ubicaciones con sugerencias. Consulta el backend (que a su vez
 * geocodifica con el proveedor externo), con debounce y cancelación de las
 * consultas obsoletas. Al elegir una sugerencia notifica a las demás islas
 * (mapa, listado) con el mismo evento de ubicación que la geolocalización.
 */
export default function SearchBox() {
	const [query, setQuery] = useState('');
	const [suggestions, setSuggestions] = useState<GeocodeSuggestion[]>([]);
	const [status, setStatus] = useState<Status>('idle');
	const [activeIndex, setActiveIndex] = useState(-1);
	const [selectedLabel, setSelectedLabel] = useState('');
	const requestIdRef = useRef(0);
	const lastQueryRef = useRef('');

	const trimmed = query.trim();
	const isOpen = status === 'open' && suggestions.length > 0;

	useEffect(() => {
		if (trimmed.length < SEARCH_MIN_LENGTH) {
			requestIdRef.current += 1;
			setSuggestions([]);
			setStatus('idle');
			setActiveIndex(-1);
			return;
		}
		const controller = new AbortController();
		const timer = setTimeout(() => fetchSuggestions(trimmed, controller.signal), SEARCH_DEBOUNCE_MS);
		return () => {
			clearTimeout(timer);
			controller.abort();
		};
	}, [query]);

	async function fetchSuggestions(q: string, signal?: AbortSignal) {
		const requestId = ++requestIdRef.current;
		lastQueryRef.current = q;
		setStatus('loading');
		try {
			const response = await fetch(apiUrl(`/api/geocode/search?q=${encodeURIComponent(q)}`), {
				signal,
			});
			if (!response.ok) throw new Error(`geocode ${response.status}`);
			const data = (await response.json()) as GeocodeSuggestion[];
			if (requestId !== requestIdRef.current) return;
			if (data.length === 0) {
				setSuggestions([]);
				setStatus('no-results');
			} else {
				setSuggestions(data);
				setActiveIndex(-1);
				setStatus('open');
			}
		} catch (error) {
			if (requestId !== requestIdRef.current) return;
			if (error instanceof DOMException && error.name === 'AbortError') return;
			setSuggestions([]);
			setStatus('error');
		}
	}

	function retry() {
		if (lastQueryRef.current) {
			fetchSuggestions(lastQueryRef.current);
		}
	}

	function select(suggestion: GeocodeSuggestion) {
		dispatchUserLocation(suggestion.latitud, suggestion.longitud);
		setSelectedLabel(suggestion.label);
		setSuggestions([]);
		setActiveIndex(-1);
		setStatus('selected');
	}

	function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
		if (event.key === 'ArrowDown') {
			event.preventDefault();
			if (suggestions.length > 0) {
				setActiveIndex((index) => (index + 1) % suggestions.length);
				setStatus('open');
			}
		} else if (event.key === 'ArrowUp') {
			event.preventDefault();
			if (suggestions.length > 0) {
				setActiveIndex((index) => (index - 1 + suggestions.length) % suggestions.length);
				setStatus('open');
			}
		} else if (event.key === 'Enter') {
			if (isOpen && activeIndex >= 0 && suggestions[activeIndex]) {
				event.preventDefault();
				select(suggestions[activeIndex]);
			}
		} else if (event.key === 'Escape') {
			setActiveIndex(-1);
			if (isOpen) setStatus('idle');
		}
	}

	function onBlur() {
		window.setTimeout(() => {
			setActiveIndex(-1);
			if (status === 'open') setStatus('idle');
		}, 120);
	}

	return (
		<div className="explorer__search">
			<div className="explorer__input-wrap">
				<span aria-hidden="true">⌖</span>
				<input
					id={SEARCH_INPUT_ID}
					type="search"
					placeholder={PLACEHOLDER}
					autoComplete="off"
					role="combobox"
					aria-expanded={isOpen}
					aria-controls={LISTBOX_ID}
					aria-autocomplete="list"
					aria-activedescendant={activeIndex >= 0 ? `${LISTBOX_ID}-option-${activeIndex}` : undefined}
					aria-busy={status === 'loading'}
					value={query}
					onChange={(event) => {
						setQuery(event.target.value);
						setActiveIndex(-1);
					}}
					onKeyDown={onKeyDown}
					onBlur={onBlur}
				/>
			</div>

			{status === 'idle' && trimmed.length > 0 && trimmed.length < SEARCH_MIN_LENGTH && (
				<p className="explorer__search-message" role="status">
					{MIN_LENGTH_HINT}
				</p>
			)}

			{(isOpen || status === 'loading' || status === 'no-results' || status === 'error') && (
				<ul
					id={LISTBOX_ID}
					className="explorer__search-listbox"
					role="listbox"
					aria-label="Sugerencias de ubicación"
				>
					{status === 'loading' && (
						<li className="explorer__search-message" role="status">
							Buscando…
						</li>
					)}
					{status === 'no-results' && (
						<li className="explorer__search-message" role="status">
							{NO_RESULTS_MESSAGE} «{lastQueryRef.current}»
						</li>
					)}
					{status === 'error' && (
						<li className="explorer__search-error" role="alert">
							<span>{ERROR_MESSAGE}</span>
							<button type="button" className="explorer__location-manual" onClick={retry}>
								Reintentar
							</button>
						</li>
					)}
					{isOpen &&
						suggestions.map((suggestion, index) => (
							<li
								key={suggestion.id}
								id={`${LISTBOX_ID}-option-${index}`}
								className="explorer__search-option"
								role="option"
								aria-selected={index === activeIndex}
								onMouseDown={(event) => {
									event.preventDefault();
									select(suggestion);
								}}
							>
								<strong>{suggestion.label}</strong>
								<span>{suggestion.fullName}</span>
							</li>
						))}
				</ul>
			)}

			{status === 'selected' && suggestions.length === 0 && (
				<p className="explorer__search-status" role="status">
					Gasolineras actualizadas a {selectedLabel}.
				</p>
			)}
		</div>
	);
}