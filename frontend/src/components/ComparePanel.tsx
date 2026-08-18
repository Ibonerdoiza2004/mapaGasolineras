import { useCallback, useEffect, useRef, useState } from 'react';

import {
	STATION_SELECT_EVENT,
	STATIONS_EVENT,
	dispatchCompareChange,
	dispatchStationDetail,
} from '../lib/explorerEvents';
import {
	LOCATION_CLEAR_EVENT,
	LOCATION_EVENT,
	distanceKm,
	type UserLocation,
} from '../lib/geolocation';
import {
	formatDistance,
	formatPrice,
	formatUpdateDate,
	isPriceFresh,
	type NearbyStation,
} from '../lib/stations';

/**
 * Columna lateral de comparación. Cada clic en una gasolinera (lista o mapa)
 * la añade o la quita del panel; el panel solo se muestra cuando hay al menos
 * una estación. Cada entrada tiene su botón para quitarla y abre la ficha
 * completa con «Ver ficha». Las entradas conservan sus datos aunque dejen de
 * estar entre los resultados; la distancia se calcula respecto a la última
 * ubicación marcada (manual o del dispositivo) y solo se muestra si existe.
 */
export default function ComparePanel() {
	const [entries, setEntries] = useState<NearbyStation[]>([]);
	const entriesRef = useRef<NearbyStation[]>([]);
	const lastStationsRef = useRef<NearbyStation[]>([]);
	const [location, setLocation] = useState<UserLocation | null>(null);

	useEffect(() => {
		function onLocation(event: Event) {
			const detail = (event as CustomEvent<UserLocation>).detail;
			if (!detail || !Number.isFinite(detail.lat) || !Number.isFinite(detail.lon)) return;
			setLocation(detail);
		}
		function onLocationClear() {
			setLocation(null);
		}
		window.addEventListener(LOCATION_EVENT, onLocation);
		window.addEventListener(LOCATION_CLEAR_EVENT, onLocationClear);
		return () => {
			window.removeEventListener(LOCATION_EVENT, onLocation);
			window.removeEventListener(LOCATION_CLEAR_EVENT, onLocationClear);
		};
	}, []);

	useEffect(() => {
		function onStations(event: Event) {
			const detail = (event as CustomEvent<{ stations: NearbyStation[] }>).detail;
			if (!detail || !Array.isArray(detail.stations)) return;
			lastStationsRef.current = detail.stations;
			// Se refrescan precios y demás datos de las estaciones ya añadidas
			// sin depender de que sigan estando en los resultados.
			const current = entriesRef.current;
			if (current.length === 0) return;
			const byId = new Map(detail.stations.map((station) => [station.id, station]));
			const next = current.map((entry) => byId.get(entry.id) ?? entry);
			entriesRef.current = next;
			setEntries(next);
		}
		window.addEventListener(STATIONS_EVENT, onStations);
		return () => window.removeEventListener(STATIONS_EVENT, onStations);
	}, []);

	const toggleStation = useCallback((id: string) => {
		const current = entriesRef.current;
		if (current.some((entry) => entry.id === id)) {
			const next = current.filter((entry) => entry.id !== id);
			entriesRef.current = next;
			setEntries(next);
			dispatchCompareChange(next.map((entry) => entry.id), null);
			return;
		}
		const station = lastStationsRef.current.find((candidate) => candidate.id === id);
		if (!station) return;
		const next = [...current, station];
		entriesRef.current = next;
		setEntries(next);
		dispatchCompareChange(next.map((entry) => entry.id), id);
	}, []);

	useEffect(() => {
		function onSelect(event: Event) {
			const detail = (event as CustomEvent<{ id: unknown }>).detail;
			if (!detail || typeof detail.id !== 'string') return;
			toggleStation(detail.id);
		}
		window.addEventListener(STATION_SELECT_EVENT, onSelect);
		return () => window.removeEventListener(STATION_SELECT_EVENT, onSelect);
	}, [toggleStation]);

	if (entries.length === 0) return null;

	return (
		<aside className="compare-panel" aria-label="Gasolineras para comparar">
			<header className="compare-panel__header">
				<h2 className="compare-panel__title">Comparar</h2>
				<span className="compare-panel__count" aria-label={`${entries.length} gasolineras para comparar`}>
					{entries.length} {entries.length === 1 ? 'gasolinera' : 'gasolineras'}
				</span>
			</header>
			<ul className="compare-panel__list">
				{entries.map((station) => {
					const hasPrice = station.precio != null;
					const isBest =
						hasPrice &&
						station.precio! > 0 &&
						station.ahorro === 0 &&
						isPriceFresh(station.fechaActualizacion);
					const fecha = formatUpdateDate(station.fechaActualizacion);
					const distance = location
						? distanceKm(location.lat, location.lon, station.latitud, station.longitud)
						: null;
					return (
						<li key={station.id} className="compare-panel__entry">
							<div className="compare-panel__entry-head">
								<h3 className="compare-panel__entry-title">{station.rotulo}</h3>
								<button
									type="button"
									className="compare-panel__remove"
									aria-label={`Quitar ${station.rotulo}`}
									onClick={() => toggleStation(station.id)}
								>
									×
								</button>
							</div>
							<p className="compare-panel__entry-address">
								{[station.direccion, station.localidad, station.provincia]
									.filter(Boolean)
									.join(', ')}
							</p>
							{isBest && <span className="station-card__tag">Mejor opción</span>}
							<dl className="compare-panel__entry-data">
								<div className="compare-panel__fact">
									<dt>Precio</dt>
									<dd>{hasPrice ? formatPrice(station.precio!) : 'No disponible'}</dd>
								</div>
								<div className="compare-panel__fact">
									<dt>Distancia</dt>
									<dd>
										{distance != null && Number.isFinite(distance)
											? formatDistance(distance)
											: '—'}
									</dd>
								</div>
								{fecha && (
									<div className="compare-panel__fact">
										<dt>Actualizado</dt>
										<dd
											className={
												hasPrice && !isPriceFresh(station.fechaActualizacion)
													? 'compare-panel__stale'
													: ''
											}
										>
											{fecha}
										</dd>
									</div>
								)}
							</dl>
							<button
								type="button"
								className="compare-panel__detail"
								onClick={() => dispatchStationDetail(station.id)}
							>
								Ver ficha
							</button>
						</li>
					);
				})}
			</ul>
		</aside>
	);
}
