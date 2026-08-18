import { useCallback, useEffect, useRef, useState } from 'react';

import { dispatchFuelChange } from '../lib/explorerEvents';
import { DEFAULT_FUEL, fuelLabel, FUEL_OPTIONS, isFuelType, type FuelType } from '../lib/fuel';
import { getUrlParam, setUrlParam } from '../lib/urlState';

const FUEL_URL_PARAM = 'combustible';

function readFuelFromUrl(): FuelType {
	const value = getUrlParam(FUEL_URL_PARAM);
	return isFuelType(value) ? value : DEFAULT_FUEL;
}

/**
 * Filtro de combustible como grupo de chips accesible (radiogroup con
 * roving tabindex). El valor se restaura desde la URL al cargar y cada
 * cambio se refleja en la URL (replaceState) y se notifica al resto de
 * islas con el evento `gasolineras:fuel`.
 */
export default function FuelFilter() {
	const [selected, setSelected] = useState<FuelType>(DEFAULT_FUEL);
	const [announcement, setAnnouncement] = useState('');
	const selectedRef = useRef(selected);
	selectedRef.current = selected;

	// Restaura el combustible desde la URL tras la hidratación (el estado
	// inicial del servidor no puede leer `window`) y notifica el valor para
	// que el listado parta del combustible correcto sin esperar al usuario.
	useEffect(() => {
		const restored = readFuelFromUrl();
		selectedRef.current = restored;
		setSelected(restored);
		dispatchFuelChange(restored);
	}, []);

	const select = useCallback((fuel: FuelType) => {
		if (selectedRef.current === fuel) {
			return;
		}
		selectedRef.current = fuel;
		setSelected(fuel);
		setUrlParam(FUEL_URL_PARAM, fuel);
		dispatchFuelChange(fuel);
		setAnnouncement(`Combustible: ${fuelLabel(fuel)}`);
	}, []);

	const onKeyDown = useCallback(
		(event: React.KeyboardEvent) => {
			const index = FUEL_OPTIONS.findIndex((option) => option.value === selectedRef.current);
			let next = index;
			if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
				next = (index + 1) % FUEL_OPTIONS.length;
			} else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
				next = (index - 1 + FUEL_OPTIONS.length) % FUEL_OPTIONS.length;
			} else if (event.key === 'Home') {
				next = 0;
			} else if (event.key === 'End') {
				next = FUEL_OPTIONS.length - 1;
			} else {
				return;
			}
			event.preventDefault();
			const target = FUEL_OPTIONS[next].value;
			select(target);
			document.getElementById(`${FUEL_GROUP_ID}-${target}`)?.focus();
		},
		[select],
	);

	return (
		<div className="explorer__fuel-group">
			<p className="explorer__field-label" id={`${FUEL_GROUP_ID}-label`}>
				Combustible
			</p>
			<div
				role="radiogroup"
				aria-labelledby={`${FUEL_GROUP_ID}-label`}
				className="explorer__chips"
				onKeyDown={onKeyDown}
			>
				{FUEL_OPTIONS.map((option) => {
					const isChecked = selected === option.value;
					return (
						<button
							key={option.value}
							type="button"
							id={`${FUEL_GROUP_ID}-${option.value}`}
							role="radio"
							aria-checked={isChecked}
							tabIndex={isChecked ? 0 : -1}
							className="explorer__chip"
							data-fuel={option.value}
							onClick={() => select(option.value)}
						>
							<span className="station-card__fuel-dot" aria-hidden="true" />
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

const FUEL_GROUP_ID = 'explorer-fuel';