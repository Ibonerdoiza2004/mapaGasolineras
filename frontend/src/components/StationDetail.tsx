import { useCallback, useEffect, useRef, useState } from 'react';

import { FUEL_EVENT, STATION_DETAIL_EVENT, dispatchStationDetail } from '../lib/explorerEvents';
import { FUEL_OPTIONS, fuelLabel, type FuelType } from '../lib/fuel';
import { fetchStationDetail, formatPrice, formatUpdateDate, isPriceFresh, type StationDetail } from '../lib/stations';

type Status = 'idle' | 'loading' | 'success' | 'error';

/**
 * Ficha de la estación seleccionada. Escucha `gasolineras:station-select`,
 * consulta `GET /api/stations/{id}` y la muestra en un panel lateral
 * (escritorio) o una hoja inferior (móvil). El cierre restaura el foco al
 * elemento que abrió la ficha.
 */
export default function StationDetail() {
	const [stationId, setStationId] = useState<string | null>(null);
	const [status, setStatus] = useState<Status>('idle');
	const [detail, setDetail] = useState<StationDetail | null>(null);
	const [selectedFuel, setSelectedFuel] = useState<FuelType | null>(null);
	const requestIdRef = useRef(0);
	const returnFocusRef = useRef<HTMLElement | null>(null);
	const panelRef = useRef<HTMLElement | null>(null);

	useEffect(() => {
		function onFuel(event: Event) {
			const detail = (event as CustomEvent<{ combustible: unknown }>).detail;
			if (!detail || typeof detail.combustible !== 'string') return;
			setSelectedFuel(detail.combustible as FuelType);
		}
		window.addEventListener(FUEL_EVENT, onFuel);
		return () => window.removeEventListener(FUEL_EVENT, onFuel);
	}, []);

	useEffect(() => {
		function onSelect(event: Event) {
			const detail = (event as CustomEvent<{ id: unknown }>).detail;
			if (!detail || (detail.id !== null && typeof detail.id !== 'string')) return;
			const id = detail.id;
			if (id === null) {
				setStationId(null);
				setStatus('idle');
				setDetail(null);
				returnFocusRef.current?.focus();
				returnFocusRef.current = null;
				return;
			}
			// Se recuerda qué tenía el foco para devolverlo al cerrar.
			if (document.activeElement instanceof HTMLElement && document.activeElement !== document.body) {
				returnFocusRef.current = document.activeElement;
			}
			setStationId(id);
			setStatus('loading');
		}
		window.addEventListener(STATION_DETAIL_EVENT, onSelect);
		return () => window.removeEventListener(STATION_DETAIL_EVENT, onSelect);
	}, []);

	const close = useCallback(() => {
		dispatchStationDetail(null);
	}, []);

	useEffect(() => {
		if (!stationId) return;
		const requestId = ++requestIdRef.current;
		setStatus('loading');
		setDetail(null);
		fetchStationDetail(stationId)
			.then((result) => {
				if (requestIdRef.current !== requestId) return;
				setDetail(result);
				setStatus('success');
			})
			.catch(() => {
				if (requestIdRef.current === requestId) {
					setStatus('error');
				}
			});
	}, [stationId]);

	useEffect(() => {
		if (status !== 'loading') return;
		panelRef.current?.focus();
	}, [status]);

	useEffect(() => {
		function onKeyDown(event: KeyboardEvent) {
			if (event.key === 'Escape' && stationId) {
				close();
			}
		}
		window.addEventListener('keydown', onKeyDown);
		return () => window.removeEventListener('keydown', onKeyDown);
	}, [stationId, close]);

	if (!stationId) return null;

	const direccionCompleta = [detail?.direccion, detail?.municipio, detail?.provincia]
		.filter(Boolean)
		.join(', ');

	return (
		<div className="station-detail__overlay">
			<div className="station-detail__scrim" onClick={close} aria-hidden="true" />
			<aside
				className="station-detail"
				role="dialog"
				aria-modal="true"
				aria-label="Ficha de la gasolinera"
				ref={panelRef}
				tabIndex={-1}
			>
				<header className="station-detail__header">
					<span className="station-detail__brand" aria-hidden="true">
						{brandInitial(detail?.rotulo)}
					</span>
					<div className="station-detail__heading">
						<h2 className="station-detail__title">{detail?.rotulo ?? 'Gasolinera'}</h2>
						{detail && (
							<p className="station-detail__subtitle">
								{direccionCompleta || 'Dirección no disponible'}
							</p>
						)}
					</div>
					<button
						type="button"
						className="station-detail__close"
						aria-label="Cerrar ficha"
						onClick={close}
					>
						×
					</button>
				</header>

			{status === 'loading' && (
				<div className="station-detail__body" aria-busy="true">
					<div className="station-detail__skeleton" />
					<div className="station-detail__skeleton" />
					<div className="station-detail__skeleton station-detail__skeleton--short" />
				</div>
			)}

			{status === 'error' && (
				<div className="station-detail__body">
					<p className="explorer__search-error" role="alert">
						No se pudo cargar la ficha de la gasolinera.
					</p>
					<button
						type="button"
						className="explorer__location-manual"
						onClick={() => {
							setStatus('loading');
							const requestId = ++requestIdRef.current;
							fetchStationDetail(stationId!)
								.then((result) => {
									if (requestIdRef.current !== requestId) return;
									setDetail(result);
									setStatus('success');
								})
								.catch(() => {
									if (requestIdRef.current === requestId) setStatus('error');
								});
						}}
					>
						Reintentar
					</button>
				</div>
			)}

			{status === 'success' && detail && (
				<div className="station-detail__body">
					{Object.keys(detail.precios).length > 0 ? (
						<ul className="station-detail__prices">
							{[...FUEL_OPTIONS]
								.sort((a, b) => {
									if (a.value === selectedFuel) return -1;
									if (b.value === selectedFuel) return 1;
									return 0;
								})
								.filter((option) => detail.precios[option.value] != null)
								.map((option) => {
									const isActive = option.value === selectedFuel;
									return (
										<li
											key={option.value}
											className={[
												'station-detail__price',
												isActive ? 'station-detail__price--active' : '',
											].join(' ')}
										>
											<span className={['station-card__fuel', fuelDotClass(option.value)].join(' ')}>
												<span className="station-card__fuel-dot" aria-hidden="true" />
												{fuelLabel(option.value)}
											</span>
											<strong>{formatPrice(detail.precios[option.value]!)}</strong>
										</li>
									);
								})}
						</ul>
					) : (
						<p className="station-detail__empty">No hay precios disponibles para esta estación.</p>
					)}

				<dl className="station-detail__facts">
					{detail.horario && (
						<div className="station-detail__fact">
							<dt>Horario</dt>
							<dd>{detail.horario}</dd>
						</div>
					)}
					{detail.tipoVenta && (
						<div className="station-detail__fact">
							<dt>Tipo de venta</dt>
							<dd>{tipoVentaLabel(detail.tipoVenta)}</dd>
						</div>
					)}
					{formatUpdateDate(detail.fechaActualizacion) && (
						<div className="station-detail__fact">
							<dt>Precios actualizados</dt>
							<dd
								className={
									Object.keys(detail.precios).length > 0 &&
									!isPriceFresh(detail.fechaActualizacion)
										? 'station-detail__stale'
										: ''
								}
							>
								{formatUpdateDate(detail.fechaActualizacion)}
							</dd>
						</div>
					)}
				</dl>
			</div>
		)}

		{status === 'success' && detail && Number.isFinite(detail.latitud) && Number.isFinite(detail.longitud) && (
			<footer className="station-detail__footer">
				<a
					className="station-detail__directions"
					href={`https://www.google.com/maps/dir/?api=1&destination=${detail.latitud},${detail.longitud}&travelmode=driving`}
					target="_blank"
					rel="noopener noreferrer"
				>
					Cómo llegar (Google Maps)
				</a>
			</footer>
		)}
			</aside>
		</div>
	);
}

function tipoVentaLabel(tipoVenta: string): string {
	return tipoVenta === 'C' ? 'Cooperativa' : 'Venta al público';
}

function brandInitial(rotulo: string | null | undefined): string {
	return (rotulo?.trim().charAt(0) ?? 'G').toUpperCase();
}

function fuelDotClass(fuel: FuelType): string {
	return `station-card__fuel--${fuel.toLowerCase().replaceAll('_', '-')}`;
}
