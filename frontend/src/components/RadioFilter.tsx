import { useCallback, useEffect, useRef, useState } from 'react';

import { dispatchRadioChange } from '../lib/explorerEvents';
import {
	dispatchLocationClear,
	getLastLocation,
	LOCATION_CLEAR_EVENT,
	LOCATION_EVENT,
	isValidCoordinates,
} from '../lib/geolocation';
import {
	DEFAULT_RADIUS_KM,
	DEFAULT_RADIO,
	isRadioValue,
	RADIO_OPTIONS,
	RADIO_URL_PARAM,
	radioLabel,
} from '../lib/radio';
import { getUrlParam, setUrlParam } from '../lib/urlState';

function readRadioValueFromUrl(): number | null {
	const value = getUrlParam(RADIO_URL_PARAM);
	if (value === null) {
		return DEFAULT_RADIO;
	}
	const parsed = Number(value);
	return isRadioValue(parsed) ? parsed : DEFAULT_RADIO;
}

function readRadioFromUrl(): number | null {
	// La URL puede sobrevivir a una recarga, pero la ubicación solo vive en
	// memoria; sin ella el radio no puede activarse todavía.
	if (!getLastLocation()) return null;
	return readRadioValueFromUrl();
}

const SCOPE_GROUP_ID = 'explorer-scope';
const RADIO_GROUP_ID = 'explorer-radio';

const SCOPE_OPTIONS = [
	{ value: 'mapa', label: 'Área visible en el mapa' },
	{ value: 'radio', label: 'Radio de búsqueda' },
] as const;

type Scope = (typeof SCOPE_OPTIONS)[number]['value'];

/**
 * Filtro de alcance de la búsqueda: un control segmentado con dos opciones,
 * "Área visible en el mapa" (por defecto) y "Radio de búsqueda". Al elegir
 * el radio aparecen los chips de kilómetros (5/10/25/50) como un radiogroup
 * con roving tabindex. El valor se restaura desde la URL al cargar y cada
 * cambio se refleja en la URL (replaceState) y se notifica al resto de
 * islas con el evento `gasolineras:radio`.
 *
 * Sin ubicación (ni compartida ni buscada) no hay punto de referencia para
 * acotar el radio, por lo que la opción de radio permanece deshabilitada. Al
 * recibir `gasolineras:location` la opción se habilita y el alcance pasa a
 * radio automáticamente con el radio elegido (o el de 10 km por defecto).
 */
export default function RadioFilter() {
	const [scope, setScope] = useState<Scope>('mapa');
	const [selected, setSelected] = useState<number>(
		readRadioValueFromUrl() ?? DEFAULT_RADIUS_KM,
	);
	const [disabled, setDisabled] = useState(() => getLastLocation() === null);
	const [announcement, setAnnouncement] = useState('');
	const selectedRef = useRef(selected);
	selectedRef.current = selected;
	const scopeRef = useRef(scope);
	scopeRef.current = scope;

	// Restaura el estado desde la URL tras la hidratación y notifica el valor
	// para que el listado y el mapa partan del filtro correcto.
	useEffect(() => {
		const restored = readRadioFromUrl();
		const active = restored !== null;
		setDisabled(getLastLocation() === null);
		scopeRef.current = active ? 'radio' : 'mapa';
		setScope(active ? 'radio' : 'mapa');
		if (restored !== null) {
			selectedRef.current = restored;
			setSelected(restored);
		}
		if (restored === null) {
			setUrlParam(RADIO_URL_PARAM, null);
		}
		dispatchRadioChange(restored);
	}, []);

	const announce = useCallback((message: string) => {
		setAnnouncement(message);
	}, []);

	const activateRadio = useCallback(() => {
		const radio = selectedRef.current;
		scopeRef.current = 'radio';
		setScope('radio');
		setUrlParam(RADIO_URL_PARAM, String(radio));
		dispatchRadioChange(radio);
		announce(`Radio de búsqueda activado: ${radioLabel(radio)}`);
	}, [announce]);

	const setScopeTo = useCallback(
		(next: Scope) => {
			if (disabled && next === 'radio') return;
			if (next === 'radio') {
				activateRadio();
				return;
			}
			scopeRef.current = next;
			setScope(next);
			setUrlParam(RADIO_URL_PARAM, null);
			dispatchRadioChange(null);
			// El modo mapa no tiene punto de referencia: se descarta la
			// ubicación marcada y desaparecen las distancias.
			dispatchLocationClear();
			announce('Radio de búsqueda desactivado: se muestran las gasolineras en el mapa');
		},
		[disabled, announce, activateRadio],
	);

	const select = useCallback((radio: number) => {
		if (selectedRef.current === radio) {
			return;
		}
		selectedRef.current = radio;
		setSelected(radio);
		setUrlParam(RADIO_URL_PARAM, String(radio));
		dispatchRadioChange(radio);
		setAnnouncement(`Radio: ${radioLabel(radio)}`);
	}, []);

	// Al recibir una ubicación (compartida o buscada) el radio se habilita y se
	// activa automáticamente: ya hay punto de referencia, así que la búsqueda
	// pasa a acotarse por kilómetros en lugar del área visible.
	useEffect(() => {
		function onLocation(event: Event) {
			const detail = (event as CustomEvent<{ lat: number; lon: number }>).detail;
			if (!detail || !isValidCoordinates(detail.lat, detail.lon)) return;
			setDisabled(false);
			activateRadio();
		}
		window.addEventListener(LOCATION_EVENT, onLocation);
		return () => window.removeEventListener(LOCATION_EVENT, onLocation);
	}, [activateRadio]);

	// Al descartarse la ubicación (p. ej. al volver al modo mapa) el radio
	// vuelve a necesitar un punto de referencia para activarse.
	useEffect(() => {
		function onLocationClear() {
			setDisabled(true);
			scopeRef.current = 'mapa';
			setScope('mapa');
			setUrlParam(RADIO_URL_PARAM, null);
			dispatchRadioChange(null);
		}
		window.addEventListener(LOCATION_CLEAR_EVENT, onLocationClear);
		return () => window.removeEventListener(LOCATION_CLEAR_EVENT, onLocationClear);
	}, []);

	const onScopeKeyDown = useCallback(
		(event: React.KeyboardEvent) => {
			const index = SCOPE_OPTIONS.findIndex((option) => option.value === scopeRef.current);
			let next = index;
			if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
				next = (index + 1) % SCOPE_OPTIONS.length;
			} else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
				next = (index - 1 + SCOPE_OPTIONS.length) % SCOPE_OPTIONS.length;
			} else {
				return;
			}
			event.preventDefault();
			const target = SCOPE_OPTIONS[next].value;
			setScopeTo(target);
			document.getElementById(`${SCOPE_GROUP_ID}-${target}`)?.focus();
		},
		[setScopeTo],
	);

	const onKeyDown = useCallback(
		(event: React.KeyboardEvent) => {
			const index = RADIO_OPTIONS.findIndex((option) => option.value === selectedRef.current);
			let next = index;
			if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
				next = (index + 1) % RADIO_OPTIONS.length;
			} else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
				next = (index - 1 + RADIO_OPTIONS.length) % RADIO_OPTIONS.length;
			} else if (event.key === 'Home') {
				next = 0;
			} else if (event.key === 'End') {
				next = RADIO_OPTIONS.length - 1;
			} else {
				return;
			}
			event.preventDefault();
			select(RADIO_OPTIONS[next].value);
			document.getElementById(`${RADIO_GROUP_ID}-${RADIO_OPTIONS[next].value}`)?.focus();
		},
		[select],
	);

	return (
		<div className="explorer__fuel-group">
			<p className="explorer__field-label" id={`${SCOPE_GROUP_ID}-label`}>
				Alcance
			</p>
			<div
				role="radiogroup"
				aria-labelledby={`${SCOPE_GROUP_ID}-label`}
				className="explorer__segmented"
				onKeyDown={onScopeKeyDown}
			>
				{SCOPE_OPTIONS.map((option) => {
					const isChecked = scope === option.value;
					return (
						<button
							key={option.value}
							type="button"
							id={`${SCOPE_GROUP_ID}-${option.value}`}
							role="radio"
							aria-checked={isChecked}
							tabIndex={isChecked ? 0 : -1}
							disabled={disabled && option.value === 'radio'}
							className="explorer__segment"
							data-scope={option.value}
							onClick={() => setScopeTo(option.value)}
						>
							{option.label}
						</button>
					);
				})}
			</div>
			{scope === 'radio' && (
				<>
					<p className="explorer__field-label" id={`${RADIO_GROUP_ID}-label`}>
						Radio en kilómetros
					</p>
					<div
						role="radiogroup"
						aria-labelledby={`${RADIO_GROUP_ID}-label`}
						className="explorer__chips"
						onKeyDown={disabled ? undefined : onKeyDown}
					>
						{RADIO_OPTIONS.map((option) => {
							const isChecked = selected === option.value;
							const optionId = `${RADIO_GROUP_ID}-${option.value}`;
							return (
								<button
									key={optionId}
									type="button"
									id={optionId}
									role="radio"
									aria-checked={isChecked}
									tabIndex={isChecked && !disabled ? 0 : -1}
									disabled={disabled}
									className="explorer__chip"
									data-radio={option.value}
									onClick={() => select(option.value)}
								>
									{option.label}
								</button>
							);
						})}
					</div>
				</>
			)}
			{announcement && (
				<p className="visually-hidden" role="status">
					{announcement}
				</p>
			)}
		</div>
	);
}
