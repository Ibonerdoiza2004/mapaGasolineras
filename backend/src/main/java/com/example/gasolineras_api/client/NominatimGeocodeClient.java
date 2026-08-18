package com.example.gasolineras_api.client;

import com.example.gasolineras_api.client.dto.GeocodePlace;
import com.example.gasolineras_api.client.dto.NominatimPlace;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpServerErrorException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URI;
import java.util.ArrayList;
import java.util.List;

/**
 * Implementación del cliente de geocodificación basada en Nominatim
 * (OpenStreetMap). El proveedor es configurable por entorno y sus datos
 * se conservan sin transformar hasta la capa de servicio.
 */
@Component
public class NominatimGeocodeClient implements GeocodeClient {

	private static final Logger log = LoggerFactory.getLogger(NominatimGeocodeClient.class);

	private static final int MAX_RESULTS = 8;

	/** Límites geográficos de España (península, Baleares y Canarias). */
	private static final String SPAIN_VIEWBOX = "-18.16,43.8,4.33,27.63";

	private final RestTemplate restTemplate;
	private final String baseUrl;
	private final String userAgent;

	public NominatimGeocodeClient(
		@Qualifier("geocodeRestTemplate") RestTemplate restTemplate,
		@Value("${app.geocode.base-url}") String baseUrl,
		@Value("${app.geocode.user-agent:MapaGasolineras/0.1}") String userAgent) {
		this.restTemplate = restTemplate;
		this.baseUrl = baseUrl.replaceAll("/+$", "");
		this.userAgent = userAgent;
	}

	@Override
	public List<GeocodePlace> search(String query) {
		URI uri = UriComponentsBuilder.fromUriString(baseUrl)
				.path("/search")
				.queryParam("q", query)
				.queryParam("format", "jsonv2")
				.queryParam("limit", MAX_RESULTS)
				.queryParam("accept-language", "es")
				.queryParam("addressdetails", "1")
				.queryParam("countrycodes", "es")
				.queryParam("viewbox", SPAIN_VIEWBOX)
				.queryParam("bounded", "1")
				.build()
				.encode()
				.toUri();
		return execute(uri);
	}

	@Override
	public List<GeocodePlace> searchByPostalCode(String postalCode) {
		URI uri = UriComponentsBuilder.fromUriString(baseUrl)
				.path("/search")
				.queryParam("postalcode", postalCode)
				.queryParam("countrycodes", "es")
				.queryParam("format", "jsonv2")
				.queryParam("limit", MAX_RESULTS)
				.queryParam("accept-language", "es")
				.queryParam("addressdetails", "1")
				.build()
				.encode()
				.toUri();
		return execute(uri);
	}

	private List<GeocodePlace> execute(URI uri) {
		log.info("Consultando el geocodificador en {}", uri);
		try {
			HttpHeaders headers = new HttpHeaders();
			headers.set(HttpHeaders.USER_AGENT, userAgent);
			ResponseEntity<NominatimPlace[]> response = restTemplate.exchange(
					uri, HttpMethod.GET, new HttpEntity<>(headers), NominatimPlace[].class);
			NominatimPlace[] places = response.getBody();
			if (places == null) {
				throw new GeocodeClientException("Respuesta vacía del geocodificador", true);
			}
			List<GeocodePlace> result = new ArrayList<>(places.length);
			for (NominatimPlace place : places) {
				result.add(new GeocodePlace(
						String.valueOf(place.placeId()),
						place.displayName(),
						place.tipo(),
						parseCoordinate(place.latitud(), "latitud"),
						parseCoordinate(place.longitud(), "longitud")));
			}
			log.info("Obtenidos {} lugares del geocodificador", result.size());
			return result;
		} catch (GeocodeClientException e) {
			throw e;
		} catch (ResourceAccessException | HttpServerErrorException e) {
			log.error("No se pudo conectar con el geocodificador: {}", e.getMessage());
			throw new GeocodeClientException(
					"No se pudo conectar con el proveedor de geocodificación", e, true);
		} catch (RestClientException e) {
			log.error("Error al procesar la respuesta del geocodificador: {}", e.getMessage(), e);
			throw new GeocodeClientException(
					"Error al procesar la respuesta del geocodificador", e, false);
		}
	}

	private double parseCoordinate(String value, String field) {
		try {
			return Double.parseDouble(value);
		} catch (NumberFormatException | NullPointerException e) {
			throw new GeocodeClientException(
					"El geocodificador devolvió una " + field + " no válida: " + value, e, false);
		}
	}
}