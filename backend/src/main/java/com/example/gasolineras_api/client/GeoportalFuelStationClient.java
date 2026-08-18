package com.example.gasolineras_api.client;

import com.example.gasolineras_api.client.dto.GeoportalResponse;
import com.example.gasolineras_api.client.dto.GeoportalStation;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpServerErrorException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.util.List;

/**
 * Implementación del cliente para el Geoportal/MITECO.
 * Consulta la API REST de datos abiertos de estaciones de servicio, que
 * responde en formato JSON.
 */
@Component
public class GeoportalFuelStationClient implements FuelStationDataClient {

	private static final Logger log = LoggerFactory.getLogger(GeoportalFuelStationClient.class);

	private final RestTemplate restTemplate;
	private final String baseUrl;

	public GeoportalFuelStationClient(
		@Qualifier("geoportalRestTemplate") RestTemplate restTemplate,
		@Value("${app.geoportal.base-url}") String baseUrl) {
		this.restTemplate = restTemplate;
		this.baseUrl = baseUrl;
	}

	@Override
	public GeoportalResponse fetchAllStations() {
		log.info("Consultando estaciones del Geoportal en {}", baseUrl);
		try {
			GeoportalResponse response = restTemplate.getForObject(baseUrl, GeoportalResponse.class);
			if (response == null) {
				throw new FuelStationDataClientException("Respuesta vacía del Geoportal", true);
			}
			List<GeoportalStation> estaciones = response.estaciones() == null
					? List.of()
					: response.estaciones();
			log.info("Obtenidas {} estaciones del Geoportal, fecha: {}",
					estaciones.size(), response.fecha());
			return new GeoportalResponse(response.fecha(), response.nota(), estaciones,
					response.resultadoConsulta());
		} catch (FuelStationDataClientException e) {
			throw e;
		} catch (ResourceAccessException | HttpServerErrorException e) {
			log.error("No se pudo obtener datos del Geoportal: {}", e.getMessage());
			throw new FuelStationDataClientException(
					"No se pudo conectar con el proveedor de datos", e, true);
		} catch (RestClientException e) {
			log.error("Error al procesar la respuesta del Geoportal: {}", e.getMessage(), e);
			throw new FuelStationDataClientException(
					"Error al procesar la respuesta del proveedor", e, false);
		}
	}
}
