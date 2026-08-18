import { useEffect, useState, type CSSProperties } from 'react';

import {
	PRICE_RANGE_EVENT,
	STATIONS_EVENT,
	dispatchPriceFilter,
	dispatchPriceRangeRequest,
	type PriceRange,
} from '../lib/explorerEvents';
import { formatPrice } from '../lib/stations';

/**
 * Slider de doble asa para filtrar por precio. El mínimo y el máximo son los
 * del dataset de resultados actuales (notificados con `gasolineras:precio-rango`);
 * cada cambio de asa notifica el filtro elegido (`gasolineras:precio`).
 */
export default function PriceFilter() {
	const [range, setRange] = useState<PriceRange | null>(null);
	const [min, setMin] = useState(0);
	const [max, setMax] = useState(0);

	useEffect(() => {
		function onRange(event: Event) {
			const detail = (event as CustomEvent<{ range?: PriceRange | null }>).detail;
			const next = detail?.range;
			if (!next || !Number.isFinite(next.min) || !Number.isFinite(next.max) || next.max < next.min) {
				setRange(null);
				return;
			}
			setRange(next);
			// Se mantiene la selección anterior cuando cae dentro del nuevo
			// rango; si no, se ajusta a los extremos (sin filtrar).
			setMin((previous) => (previous >= next.min && previous <= next.max ? previous : next.min));
			setMax((previous) => (previous >= next.min && previous <= next.max ? previous : next.max));
		}
		window.addEventListener(PRICE_RANGE_EVENT, onRange);
		return () => window.removeEventListener(PRICE_RANGE_EVENT, onRange);
	}, []);

	useEffect(() => {
		const request = () => dispatchPriceRangeRequest();
		window.addEventListener(STATIONS_EVENT, request);
		request();
		return () => window.removeEventListener(STATIONS_EVENT, request);
	}, []);

	if (!range) return null;

	const step = 0.001;
	const span = range.max - range.min || 1;
	const minPercent = ((min - range.min) / span) * 100;
	const maxPercent = ((max - range.min) / span) * 100;
	// Los precios tienen 3 decimales; redondear evita los residuos de coma
	// flotante (1.4 + 0.001 → 1.4010000000000001).
	const round3 = (value: number) => Math.round(value * 1000) / 1000;
	const changeMin = (value: number) => {
		const next = round3(Math.min(value, max - step));
		setMin(next);
		dispatchPriceFilter(next, max);
	};
	const changeMax = (value: number) => {
		const next = round3(Math.max(value, min + step));
		setMax(next);
		dispatchPriceFilter(min, next);
	};

	return (
		<div className="price-filter" role="group" aria-label="Filtrar por precio">
			<div className="price-filter__label">
				<span className="price-filter__title">Precio</span>
				<span className="price-filter__value">
					{formatPrice(min)} – {formatPrice(max)}
				</span>
			</div>
			<div
				className="price-filter__track"
				style={
					{
						'--price-start': `${minPercent}%`,
						'--price-end': `${maxPercent}%`,
					} as CSSProperties
				}
			>
				<input
					type="range"
					aria-label="Precio mínimo"
					min={range.min}
					max={range.max}
					step={step}
					value={min}
					onChange={(event) => changeMin(Number(event.target.value))}
				/>
				<input
					type="range"
					aria-label="Precio máximo"
					min={range.min}
					max={range.max}
					step={step}
					value={max}
					onChange={(event) => changeMax(Number(event.target.value))}
				/>
			</div>
		</div>
	);
}
