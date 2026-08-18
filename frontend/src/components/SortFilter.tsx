import { useCallback, useEffect, useRef, useState } from 'react';

import { dispatchOrdenChange } from '../lib/explorerEvents';
import { getLastLocation, LOCATION_CLEAR_EVENT, LOCATION_EVENT } from '../lib/geolocation';
import { DEFAULT_ORDER, isOrderBy, ORDER_OPTIONS, type OrderBy } from '../lib/stations';
import { getUrlParam, setUrlParam } from '../lib/urlState';

const ORDEN_URL_PARAM = 'orden';

function readOrdenFromUrl(): OrderBy {
	const value = getUrlParam(ORDEN_URL_PARAM);
	return isOrderBy(value) ? value : DEFAULT_ORDER;
}

/** El orden por cercanía solo tiene sentido con una ubicación marcada. */
function canOrderByDistance(): boolean {
	return getLastLocation() != null;
}

const DISTANCE_TITLE = 'Activa tu ubicación o busca un lugar para ordenar por cercanía';

/**
 * Ordenación de resultados como grupo de chips accesible (radiogroup con
 * roving tabindex). El valor se restaura desde la URL al cargar y cada
 * cambio se refleja en la URL (replaceState) y se notifica al listado con
 * el evento `gasolineras:orden`. Sin una ubicación marcada, ordenar por
 * cercanía queda bloqueado y se fuerza el orden por precio.
 */
export default function SortFilter() {
	const [selected, setSelected] = useState<OrderBy>(DEFAULT_ORDER);
	const [hasLocation, setHasLocation] = useState(canOrderByDistance());
	const [announcement, setAnnouncement] = useState('');
	const selectedRef = useRef(selected);
	selectedRef.current = selected;

	useEffect(() => {
		function onLocation() {
			setHasLocation(true);
		}
		function onLocationClear() {
			setHasLocation(false);
		}
		window.addEventListener(LOCATION_EVENT, onLocation);
		window.addEventListener(LOCATION_CLEAR_EVENT, onLocationClear);
		return () => {
			window.removeEventListener(LOCATION_EVENT, onLocation);
			window.removeEventListener(LOCATION_CLEAR_EVENT, onLocationClear);
		};
	}, []);

	useEffect(() => {
		const restored = readOrdenFromUrl();
		// Sin ubicación marcada no se puede ordenar por cercanía: se fuerza el
		// orden por defecto y se deja la URL consistente.
		if (restored === 'distancia' && !hasLocation) {
			selectedRef.current = DEFAULT_ORDER;
			setSelected(DEFAULT_ORDER);
			setUrlParam(ORDEN_URL_PARAM, DEFAULT_ORDER);
			dispatchOrdenChange(DEFAULT_ORDER);
			return;
		}
		selectedRef.current = restored;
		setSelected(restored);
		dispatchOrdenChange(restored);
	}, [hasLocation]);

	const select = useCallback((orden: OrderBy) => {
		if (selectedRef.current === orden) {
			return;
		}
		if (orden === 'distancia' && !canOrderByDistance()) {
			return;
		}
		selectedRef.current = orden;
		setSelected(orden);
		setUrlParam(ORDEN_URL_PARAM, orden);
		dispatchOrdenChange(orden);
		setAnnouncement(`Ordenar por ${ORDER_OPTIONS.find((o) => o.value === orden)?.label}`);
	}, []);

	const onKeyDown = useCallback(
		(event: React.KeyboardEvent) => {
			const enabled = ORDER_OPTIONS.filter(
				(option) => option.value !== 'distancia' || hasLocation,
			);
			const index = enabled.findIndex((option) => option.value === selectedRef.current);
			let next = index;
			if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
				next = (index + 1) % enabled.length;
			} else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
				next = (index - 1 + enabled.length) % enabled.length;
			} else if (event.key === 'Home') {
				next = 0;
			} else if (event.key === 'End') {
				next = enabled.length - 1;
			} else {
				return;
			}
			event.preventDefault();
			const target = enabled[next].value;
			select(target);
			document.getElementById(`${ORDEN_GROUP_ID}-${target}`)?.focus();
		},
		[select, hasLocation],
	);

	return (
		<div className="explorer__fuel-group">
			<p className="explorer__field-label" id={`${ORDEN_GROUP_ID}-label`}>
				Ordenar resultados
			</p>
			<div
				role="radiogroup"
				aria-labelledby={`${ORDEN_GROUP_ID}-label`}
				className="explorer__chips"
				onKeyDown={onKeyDown}
			>
				{ORDER_OPTIONS.map((option) => {
					const isChecked = selected === option.value;
					const disabled = option.value === 'distancia' && !hasLocation;
					return (
						<button
							key={option.value}
							type="button"
							id={`${ORDEN_GROUP_ID}-${option.value}`}
							role="radio"
							aria-checked={isChecked}
							aria-disabled={disabled || undefined}
							disabled={disabled}
							tabIndex={isChecked ? 0 : -1}
							className="explorer__chip"
							data-orden={option.value}
							title={disabled ? DISTANCE_TITLE : undefined}
							onClick={() => select(option.value)}
						>
							{option.label}
						</button>
					);
				})}
			</div>
			{announcement && (
				<p className="visually-hidden" role="status">
					{announcement}
				</p>
			)}
		</div>
	);
}

const ORDEN_GROUP_ID = 'explorer-orden';
