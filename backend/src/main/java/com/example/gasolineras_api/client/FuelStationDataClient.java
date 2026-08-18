package com.example.gasolineras_api.client;

import com.example.gasolineras_api.client.dto.GeoportalResponse;

/**
 * Cliente para consultar datos oficiales de estaciones de servicio del Geoportal/MITECO.
 */
public interface FuelStationDataClient {

	/**
	 * Obtiene todas las estaciones de servicio con sus precios actuales.
	 *
	 * @return respuesta con la lista de estaciones y fecha de datos
	 * @throws FuelStationDataClientException si ocurre un error en la comunicación
	 */
	GeoportalResponse fetchAllStations();
}
