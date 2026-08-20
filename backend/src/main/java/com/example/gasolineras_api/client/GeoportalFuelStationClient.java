package com.example.gasolineras_api.client;

import com.example.gasolineras_api.client.dto.GeoportalResponse;
import com.example.gasolineras_api.client.dto.GeoportalStation;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
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
	private final int retryMaxAttempts;
	private final long retryDelayMs;

	@Autowired
	public GeoportalFuelStationClient(
		@Qualifier("geoportalRestTemplate") RestTemplate restTemplate,
		@Value("${app.geoportal.base-url}") String baseUrl,
		@Value("${app.geoportal.retry-max-attempts:4}") int retryMaxAttempts,
		@Value("${app.geoportal.retry-delay-ms:30000}") long retryDelayMs) {
		this.restTemplate = restTemplate;
		this.baseUrl = baseUrl;
		this.retryMaxAttempts = Math.max(1, retryMaxAttempts);
		this.retryDelayMs = Math.max(0, retryDelayMs);
	}

	/**
	 * Constructor sin reintentos (máximo 1 intento), para tests.
	 */
	public GeoportalFuelStationClient(RestTemplate restTemplate, String baseUrl) {
		this(restTemplate, baseUrl, 1, 0);
	}

	@Override
	public GeoportalResponse fetchAllStations() {
		log.info("Consultando estaciones del Geoportal en {}", baseUrl);
		int attempt = 1;
		while (true) {
			try {
				return fetchOnce();
			} catch (FuelStationDataClientException e) {
				if (!e.isProviderUnavailable() || attempt >= retryMaxAttempts) {
					throw e;
				}
				log.warn("Intento {} de {} fallido (proveedor no disponible), reintentando en {} ms: {}",
						attempt, retryMaxAttempts, retryDelayMs, e.getMessage());
				sleepQuietly(retryDelayMs);
				attempt++;
			}
		}
	}

	private GeoportalResponse fetchOnce() {
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

	private static void sleepQuietly(long millis) {
		try {
			Thread.sleep(millis);
		} catch (InterruptedException e) {
			Thread.currentThread().interrupt();
			throw new FuelStationDataClientException("Interrumpido durante el reintento", e, true);
		}
	}
}
