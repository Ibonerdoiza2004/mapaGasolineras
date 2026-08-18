import { useEffect, useState } from 'react';

import {
	describeLocationError,
	dispatchUserLocation,
	isValidCoordinates,
	LOCATION_CLEAR_EVENT,
	type GeolocationErrorKind,
} from '../lib/geolocation';

type Status = 'idle' | 'locating' | 'located' | GeolocationErrorKind;

const ERROR_MESSAGES: Record<GeolocationErrorKind, string> = {
	denied: 'No podemos acceder a tu ubicación. Revisa los permisos del navegador.',
	timeout: 'Tardamos demasiado en obtener tu ubicación. Inténtalo de nuevo.',
	unavailable: 'No se pudo obtener la ubicación de tu dispositivo. Prueba de nuevo.',
	unsupported: 'Este navegador no permite compartir la ubicación.',
	invalid: 'La ubicación recibida no es válida. Prueba de nuevo.',
};

const LOCATED_MESSAGE = 'Gasolineras actualizadas a tu ubicación.';
const MANUAL_ALT = 'Puedes buscar una ciudad, dirección o código postal.';
const SEARCH_INPUT_ID = 'explorer-search';

/**
 * Pide la ubicación del dispositivo solo cuando el usuario lo solicita de forma
 * explícita. Si se concede, notifica a las demás islas (mapa, listado) con un
 * evento de ventana; si se deniega, caduca o no está disponible, muestra una
 * explicación y ofrece la búsqueda manual como alternativa.
 */
export default function LocationButton() {
	const [status, setStatus] = useState<Status>('idle');

	const isLocating = status === 'locating';
	const isError =
		status === 'denied' ||
		status === 'timeout' ||
		status === 'unavailable' ||
		status === 'unsupported' ||
		status === 'invalid';

	useEffect(() => {
		function onLocationClear() {
			setStatus('idle');
		}
		window.addEventListener(LOCATION_CLEAR_EVENT, onLocationClear);
		return () => window.removeEventListener(LOCATION_CLEAR_EVENT, onLocationClear);
	}, []);

	function requestLocation() {
		if (isLocating) return;
		if (typeof navigator === 'undefined' || !navigator.geolocation) {
			setStatus('unsupported');
			return;
		}
		setStatus('locating');
		navigator.geolocation.getCurrentPosition(
			(position) => {
				const { latitude, longitude } = position.coords;
				if (!isValidCoordinates(latitude, longitude)) {
					setStatus('invalid');
					return;
				}
				dispatchUserLocation(latitude, longitude, 'device');
				setStatus('located');
			},
			(error) => {
				setStatus(describeLocationError(error.code));
			},
			{ timeout: 10000, maximumAge: 30000 },
		);
	}

	function focusManualSearch() {
		document.getElementById(SEARCH_INPUT_ID)?.focus();
	}

	return (
		<div className="explorer__location-group">
			<button
				className="explorer__location"
				type="button"
				onClick={requestLocation}
				disabled={isLocating}
				aria-busy={isLocating}
			>
				<span aria-hidden="true">◎</span>
				{isLocating ? 'Obteniendo ubicación…' : 'Usar mi ubicación'}
			</button>
			{status === 'located' && (
				<p className="explorer__location-status" role="status">
					{LOCATED_MESSAGE}
				</p>
			)}
			{isError && (
				<p className="explorer__location-error" role="alert">
					{ERROR_MESSAGES[status as GeolocationErrorKind]} {MANUAL_ALT}{' '}
					<button
						type="button"
						className="explorer__location-manual"
						onClick={focusManualSearch}
					>
						Buscar por ciudad o código postal
					</button>
				</p>
			)}
		</div>
	);
}