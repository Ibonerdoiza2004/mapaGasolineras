package com.example.gasolineras_api.client;

import com.example.gasolineras_api.client.dto.GeoportalResponse;
import com.example.gasolineras_api.client.dto.GeoportalStation;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestTemplate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class GeoportalFuelStationClientTest {

	private static final String BASE_URL = "http://provider.example/api/stations";

	private RestTemplate restTemplate;
	private MockRestServiceServer server;
	private GeoportalFuelStationClient client;

	@BeforeEach
	void setUp() {
		restTemplate = new RestTemplate();
		server = MockRestServiceServer.createServer(restTemplate);
		client = new GeoportalFuelStationClient(restTemplate, BASE_URL);
	}

	@AfterEach
	void tearDown() {
		server.verify();
	}

	@Test
	@DisplayName("Una respuesta válida devuelve estaciones y fecha")
	void validResponseReturnsStationsAndDate() {
		String json = """
				{
				  "Fecha": "17/08/2026 15:43:34",
				  "Nota": "Archivo de todos los productos.",
				  "ListaEESSPrecio": [
				    {
				      "C.P.": "02250",
				      "Dirección": "AVENIDA CASTILLA LA MANCHA, 26",
				      "Horario": "L-D: 07:00-22:00",
				      "Latitud": "39,211417",
				      "Localidad": "ABENGIBRE",
				      "Longitud (WGS84)": "-1,539167",
				      "Margen": "D",
				      "Municipio": "Abengibre",
				      "Precio Gasoleo A": "1,749",
				      "Precio Gasolina 95 E5": "1,599",
				      "Precio Gasolina 98 E5": "1,699",
				      "Provincia": "ALBACETE",
				      "Remisión": "dm",
				      "Rótulo": "REPSOL",
				      "Tipo Venta": "P",
				      "% BioEtanol": "0,0",
				      "% Éster metílico": "0,0",
				      "IDEESS": "4375",
				      "IDMunicipio": "52",
				      "IDProvincia": "02",
				      "IDCCAA": "07"
				    }
				  ],
				  "ResultadoConsulta": "OK"
				}
				""";

		server.expect(requestTo(BASE_URL))
				.andExpect(method(HttpMethod.GET))
				.andRespond(withSuccess(json, MediaType.APPLICATION_JSON));

		GeoportalResponse response = client.fetchAllStations();

		assertThat(response.fecha()).isEqualTo("17/08/2026 15:43:34");
		assertThat(response.resultadoConsulta()).isEqualTo("OK");
		assertThat(response.estaciones()).hasSize(1);

		GeoportalStation station = response.estaciones().getFirst();
		assertThat(station.id()).isEqualTo("4375");
		assertThat(station.rotulo()).isEqualTo("REPSOL");
		assertThat(station.direccion()).isEqualTo("AVENIDA CASTILLA LA MANCHA, 26");
		assertThat(station.horario()).isEqualTo("L-D: 07:00-22:00");
		assertThat(station.latitud()).isEqualTo("39,211417");
		assertThat(station.longitud()).isEqualTo("-1,539167");
		assertThat(station.precioGasoleoA()).isEqualTo("1,749");
		assertThat(station.precioGasolina95E5()).isEqualTo("1,599");
		assertThat(station.precioGasolina98E5()).isEqualTo("1,699");
		assertThat(station.tipoVenta()).isEqualTo("P");
		assertThat(station.margen()).isEqualTo("D");
	}

	@Test
	@DisplayName("Una respuesta sin lista de estaciones devuelve lista vacía")
	void responseWithoutStationsReturnsEmptyList() {
		String json = """
				{
				  "Fecha": "17/08/2026 15:43:34",
				  "Nota": "Sin datos.",
				  "ResultadoConsulta": "OK"
				}
				""";

		server.expect(requestTo(BASE_URL))
				.andExpect(method(HttpMethod.GET))
				.andRespond(withSuccess(json, MediaType.APPLICATION_JSON));

		GeoportalResponse response = client.fetchAllStations();

		assertThat(response.fecha()).isEqualTo("17/08/2026 15:43:34");
		assertThat(response.estaciones()).isEmpty();
	}

	@Test
	@DisplayName("Un error 5xx del proveedor lanza excepción con providerUnavailable")
	void serverErrorThrowsExceptionWithProviderUnavailable() {
		server.expect(requestTo(BASE_URL))
				.andExpect(method(HttpMethod.GET))
				.andRespond(withServerError());

		assertThatThrownBy(() -> client.fetchAllStations())
				.isInstanceOf(FuelStationDataClientException.class)
				.satisfies(ex -> {
					FuelStationDataClientException exception = (FuelStationDataClientException) ex;
					assertThat(exception.isProviderUnavailable()).isTrue();
				});
	}

	@Test
	@DisplayName("Un fallo de red lanza excepción con providerUnavailable")
	void networkFailureThrowsExceptionWithProviderUnavailable() {
		server.expect(requestTo(BASE_URL))
				.andExpect(method(HttpMethod.GET))
				.andRespond(request -> {
					throw new ResourceAccessException("Timeout de conexión");
				});

		assertThatThrownBy(() -> client.fetchAllStations())
				.isInstanceOf(FuelStationDataClientException.class)
				.satisfies(ex -> {
					FuelStationDataClientException exception = (FuelStationDataClientException) ex;
					assertThat(exception.isProviderUnavailable()).isTrue();
				});
	}

	@Test
	@DisplayName("Una respuesta con múltiples estaciones las devuelve todas")
	void multipleStationsReturnsAll() {
		String json = """
				{
				  "Fecha": "17/08/2026 15:43:34",
				  "ListaEESSPrecio": [
				    { "IDEESS": "1", "Rótulo": "REPSOL", "Latitud": "40,4168", "Longitud (WGS84)": "-3,7038" },
				    { "IDEESS": "2", "Rótulo": "CEPSA", "Latitud": "40,4178", "Longitud (WGS84)": "-3,7048" },
				    { "IDEESS": "3", "Rótulo": "BPs", "Latitud": "40,4188", "Longitud (WGS84)": "-3,7058" }
				  ],
				  "ResultadoConsulta": "OK"
				}
				""";

		server.expect(requestTo(BASE_URL))
				.andExpect(method(HttpMethod.GET))
				.andRespond(withSuccess(json, MediaType.APPLICATION_JSON));

		GeoportalResponse response = client.fetchAllStations();

		assertThat(response.estaciones()).hasSize(3);
		assertThat(response.estaciones().get(0).rotulo()).isEqualTo("REPSOL");
		assertThat(response.estaciones().get(1).rotulo()).isEqualTo("CEPSA");
		assertThat(response.estaciones().get(2).rotulo()).isEqualTo("BPs");
	}

	@Test
	@DisplayName("Los campos de combustible no soportados en el MVP se ignoran sin fallar")
	void unsupportedFuelFieldsAreIgnored() {
		String json = """
				{
				  "Fecha": "17/08/2026 15:43:34",
				  "ListaEESSPrecio": [
				    {
				      "IDEESS": "4375",
				      "Precio Gasoleo A": "1,749",
				      "Precio Gasolina 95 E5": "1,599",
				      "Precio Gasolina 98 E5": "1,699",
				      "Precio Adblue": "0,300",
				      "Precio Hidrogeno": "9,500",
				      "Precio Gas Natural Comprimido": "1,200",
				      "Precio Gasoleo Premium": "1,850"
				    }
				  ],
				  "ResultadoConsulta": "OK"
				}
				""";

		server.expect(requestTo(BASE_URL))
				.andExpect(method(HttpMethod.GET))
				.andRespond(withSuccess(json, MediaType.APPLICATION_JSON));

		GeoportalResponse response = client.fetchAllStations();

		assertThat(response.estaciones()).hasSize(1);
		GeoportalStation station = response.estaciones().getFirst();
		assertThat(station.precioGasoleoA()).isEqualTo("1,749");
		assertThat(station.precioGasolina95E5()).isEqualTo("1,599");
		assertThat(station.precioGasolina98E5()).isEqualTo("1,699");
	}
}
