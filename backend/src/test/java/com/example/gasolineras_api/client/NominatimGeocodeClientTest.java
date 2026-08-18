package com.example.gasolineras_api.client;

import com.example.gasolineras_api.client.dto.GeocodePlace;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestTemplate;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class NominatimGeocodeClientTest {

	private static final String BASE_URL = "http://provider.example/geocode/";
	private static final String USER_AGENT = "MapaGasolineras/0.1";
	private static final String SEARCH_PARAMS =
			"format=jsonv2&limit=8&accept-language=es&addressdetails=1"
					+ "&countrycodes=es&viewbox=-18.16,43.8,4.33,27.63&bounded=1";

	private RestTemplate restTemplate;
	private MockRestServiceServer server;
	private NominatimGeocodeClient client;

	@BeforeEach
	void setUp() {
		restTemplate = new RestTemplate();
		server = MockRestServiceServer.createServer(restTemplate);
		client = new NominatimGeocodeClient(restTemplate, BASE_URL, USER_AGENT);
	}

	@AfterEach
	void tearDown() {
		server.verify();
	}

	@Test
	@DisplayName("Una respuesta válida devuelve lugares con coordenadas")
	void validResponseReturnsPlaces() {
		String json = """
				[
				  {
				    "place_id": 230445241,
				    "display_name": "Madrid, Comunidad de Madrid, España",
				    "type": "city",
				    "lat": "40.4167754",
				    "lon": "-3.7037902"
				  },
				  {
				    "place_id": 230445242,
				    "display_name": "Calle Gran Vía 1, Madrid, España",
				    "type": "road",
				    "lat": "40.4202778",
				    "lon": "-3.7057757"
				  }
				]
				""";

		server.expect(requestTo(BASE_URL + "search?q=madrid&" + SEARCH_PARAMS))
				.andExpect(method(HttpMethod.GET))
				.andExpect(header(HttpHeaders.USER_AGENT, USER_AGENT))
				.andRespond(withSuccess(json, MediaType.APPLICATION_JSON));

		List<GeocodePlace> places = client.search("madrid");

		assertThat(places).hasSize(2);
		GeocodePlace madrid = places.get(0);
		assertThat(madrid.id()).isEqualTo("230445241");
		assertThat(madrid.displayName()).isEqualTo("Madrid, Comunidad de Madrid, España");
		assertThat(madrid.tipo()).isEqualTo("city");
		assertThat(madrid.lat()).isEqualTo(40.4167754);
		assertThat(madrid.lon()).isEqualTo(-3.7037902);
	}

	@Test
	@DisplayName("Una consulta con caracteres especiales se codifica en la URL")
	void specialCharactersAreEncoded() {
		String json = "[]";

		server.expect(requestTo(BASE_URL
				+ "search?q=San%20Sebasti%C3%A1n&" + SEARCH_PARAMS))
				.andRespond(withSuccess(json, MediaType.APPLICATION_JSON));

		List<GeocodePlace> places = client.search("San Sebastián");

		assertThat(places).isEmpty();
	}

	@Test
	@DisplayName("Una respuesta vacía devuelve lista vacía")
	void emptyResponseReturnsEmptyList() {
		server.expect(requestTo(BASE_URL + "search?q=zzz&" + SEARCH_PARAMS))
				.andRespond(withSuccess("[]", MediaType.APPLICATION_JSON));

		List<GeocodePlace> places = client.search("zzz");

		assertThat(places).isEmpty();
	}

	@Test
	@DisplayName("Una búsqueda por código postal usa la consulta estructurada del proveedor")
	void postalCodeUsesStructuredSearch() {
		String json = """
				[
				  {
				    "place_id": 1901,
				    "display_name": "Torremolinos, Málaga, España",
				    "type": "town",
				    "lat": "36.6223",
				    "lon": "-4.4996"
				  }
				]
				""";

		server.expect(requestTo(BASE_URL
				+ "search?postalcode=29620&countrycodes=es&format=jsonv2&limit=8"
				+ "&accept-language=es&addressdetails=1"))
				.andExpect(method(HttpMethod.GET))
				.andExpect(header(HttpHeaders.USER_AGENT, USER_AGENT))
				.andRespond(withSuccess(json, MediaType.APPLICATION_JSON));

		List<GeocodePlace> places = client.searchByPostalCode("29620");

		assertThat(places).hasSize(1);
		assertThat(places.get(0).displayName()).isEqualTo("Torremolinos, Málaga, España");
	}

	@Test
	@DisplayName("Una coordenada no numérica lanza excepción sin marcar el proveedor como no disponible")
	void invalidCoordinateThrowsExceptionNotUnavailable() {
		String json = """
				[
				  {
				    "place_id": 1,
				    "display_name": "Lugar raro, España",
				    "type": "city",
				    "lat": "cuarenta",
				    "lon": "-3.7037902"
				  }
				]
				""";

		server.expect(requestTo(BASE_URL + "search?q=rar&" + SEARCH_PARAMS))
				.andRespond(withSuccess(json, MediaType.APPLICATION_JSON));

		assertThatThrownBy(() -> client.search("rar"))
				.isInstanceOf(GeocodeClientException.class)
				.satisfies(ex -> {
					GeocodeClientException exception = (GeocodeClientException) ex;
					assertThat(exception.isProviderUnavailable()).isFalse();
				});
	}

	@Test
	@DisplayName("Un error 5xx del proveedor lanza excepción con providerUnavailable")
	void serverErrorThrowsExceptionWithProviderUnavailable() {
		server.expect(requestTo(BASE_URL + "search?q=madrid&" + SEARCH_PARAMS))
				.andRespond(withServerError());

		assertThatThrownBy(() -> client.search("madrid"))
				.isInstanceOf(GeocodeClientException.class)
				.satisfies(ex -> {
					GeocodeClientException exception = (GeocodeClientException) ex;
					assertThat(exception.isProviderUnavailable()).isTrue();
				});
	}

	@Test
	@DisplayName("Un fallo de red lanza excepción con providerUnavailable")
	void networkFailureThrowsExceptionWithProviderUnavailable() {
		server.expect(requestTo(BASE_URL + "search?q=madrid&" + SEARCH_PARAMS))
				.andRespond(request -> {
					throw new ResourceAccessException("Timeout de conexión");
				});

		assertThatThrownBy(() -> client.search("madrid"))
				.isInstanceOf(GeocodeClientException.class)
				.satisfies(ex -> {
					GeocodeClientException exception = (GeocodeClientException) ex;
					assertThat(exception.isProviderUnavailable()).isTrue();
				});
	}

	@Test
	@DisplayName("Un error 4xx del proveedor lanza excepción sin marcar el proveedor como no disponible")
	void clientErrorThrowsExceptionNotUnavailable() {
		server.expect(requestTo(BASE_URL + "search?q=madrid&" + SEARCH_PARAMS))
				.andRespond(withStatus(HttpStatus.BAD_REQUEST));

		assertThatThrownBy(() -> client.search("madrid"))
				.isInstanceOf(GeocodeClientException.class)
				.satisfies(ex -> {
					GeocodeClientException exception = (GeocodeClientException) ex;
					assertThat(exception.isProviderUnavailable()).isFalse();
				});
	}
}