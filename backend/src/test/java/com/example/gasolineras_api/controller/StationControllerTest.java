package com.example.gasolineras_api.controller;

import com.example.gasolineras_api.domain.FuelType;
import com.example.gasolineras_api.dto.NearbyStationDto;
import com.example.gasolineras_api.dto.MapStationDto;
import com.example.gasolineras_api.dto.PriceRangeDto;
import com.example.gasolineras_api.exception.GlobalExceptionHandler;
import com.example.gasolineras_api.service.StationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.math.BigDecimal;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.hamcrest.Matchers.containsString;

class StationControllerTest {

	private StationService stationService;
	private MockMvc mockMvc;

	@BeforeEach
	void setUp() {
		stationService = mock(StationService.class);
		StationController controller = new StationController(stationService);
		mockMvc = MockMvcBuilders.standaloneSetup(controller)
				.setControllerAdvice(new GlobalExceptionHandler())
				.build();
	}

	@Test
	@DisplayName("Una petición válida devuelve las estaciones cercanas")
	void validRequestReturnsNearbyStations() throws Exception {
		when(stationService.findNearby(anyDouble(), anyDouble(), anyDouble(),
				eq(null), eq(FuelType.GASOLINA_95), any(), isNull(), isNull(), isNull(), isNull(), any()))
				.thenReturn(List.of(
						new NearbyStationDto("1", "REPSOL", "DIR", "Madrid", "Madrid",
								40.4168, -3.7038, 2.5, new BigDecimal("1.599"),
								new BigDecimal("0.000"), "17/08/2026")
				));

		mockMvc.perform(get("/api/stations/nearby")
						.param("lat", "40.4168")
						.param("lon", "-3.7038")
						.param("radio", "10")
						.param("combustible", "GASOLINA_95")
						.contentType(MediaType.APPLICATION_JSON))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$[0].id").value("1"))
				.andExpect(jsonPath("$[0].rotulo").value("REPSOL"))
				.andExpect(jsonPath("$[0].distanciaKm").value(2.5))
				.andExpect(jsonPath("$[0].precio").value(1.599));
	}

	@Test
	@DisplayName("Latitud fuera de rango devuelve 400")
	void outOfRangeLatitudeReturns400() throws Exception {
		mockMvc.perform(get("/api/stations/nearby")
						.param("lat", "100")
						.param("lon", "-3.7038")
						.param("radio", "10")
						.param("combustible", "GASOLINA_95"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("INVALID_PARAMETER"));
	}

	@Test
	@DisplayName("Radio negativo devuelve 400")
	void negativeRadiusReturns400() throws Exception {
		mockMvc.perform(get("/api/stations/nearby")
						.param("lat", "40.4168")
						.param("lon", "-3.7038")
						.param("radio", "-5")
						.param("combustible", "GASOLINA_95"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("INVALID_PARAMETER"));
	}

	@Test
	@DisplayName("Radio superior al máximo (50 km) devuelve 400")
	void radiusOverMaxReturns400() throws Exception {
		mockMvc.perform(get("/api/stations/nearby")
						.param("lat", "40.4168")
						.param("lon", "-3.7038")
						.param("radio", "51")
						.param("combustible", "GASOLINA_95"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("INVALID_PARAMETER"));
	}

	@Test
	@DisplayName("Radio cero devuelve 400")
	void zeroRadiusReturns400() throws Exception {
		mockMvc.perform(get("/api/stations/nearby")
						.param("lat", "40.4168")
						.param("lon", "-3.7038")
						.param("radio", "0")
						.param("combustible", "GASOLINA_95"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("INVALID_PARAMETER"));
	}

	@Test
	@DisplayName("Radio en el límite máximo (50 km) es válido")
	void maxRadiusIsValid() throws Exception {
		when(stationService.findNearby(anyDouble(), anyDouble(), eq(50.0),
				eq(null), eq(FuelType.GASOLINA_95), any(), isNull(), isNull(), isNull(), isNull(), any()))
				.thenReturn(List.of());

		mockMvc.perform(get("/api/stations/nearby")
						.param("lat", "40.4168")
						.param("lon", "-3.7038")
						.param("radio", "50")
						.param("combustible", "GASOLINA_95"))
				.andExpect(status().isOk());
	}

	@Test
	@DisplayName("Sin radio se consulta con el viewport del mapa cuando se envía")
	void missingRadioUsesViewportBounds() throws Exception {
		when(stationService.findNearby(eq(40.4168), eq(-3.7038), eq(null),
				org.mockito.ArgumentMatchers.argThat((StationService.Bounds b) ->
						b != null && b.minLat() == 36.0 && b.maxLat() == 44.0
								&& b.minLon() == -10.0 && b.maxLon() == 3.0),
				eq(FuelType.GASOLINA_95), any(), anyInt(), isNull(), isNull(), isNull(), any()))
				.thenReturn(List.of(
						new NearbyStationDto("9", "BALLENOIL", "DIR", "Madrid", "Madrid",
								40.0, -3.0, 350.0, new BigDecimal("1.599"),
								new BigDecimal("0.000"), "17/08/2026")
				));

		mockMvc.perform(get("/api/stations/nearby")
						.param("lat", "40.4168")
						.param("lon", "-3.7038")
						.param("combustible", "GASOLINA_95")
						.param("minLat", "36")
						.param("maxLat", "44")
						.param("minLon", "-10")
						.param("maxLon", "3"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$[0].id").value("9"));
	}

	@Test
	@DisplayName("Límites de viewport incompletos devuelven 400")
	void partialBoundsReturn400() throws Exception {
		mockMvc.perform(get("/api/stations/nearby")
						.param("lat", "40.4168")
						.param("lon", "-3.7038")
						.param("combustible", "GASOLINA_95")
						.param("minLat", "36"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("INVALID_PARAMETER"));
	}

	@Test
	@DisplayName("Límites de viewport invertidos devuelven 400")
	void invertedBoundsReturn400() throws Exception {
		mockMvc.perform(get("/api/stations/nearby")
						.param("lat", "40.4168")
						.param("lon", "-3.7038")
						.param("combustible", "GASOLINA_95")
						.param("minLat", "44")
						.param("maxLat", "36")
						.param("minLon", "-10")
						.param("maxLon", "3"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("INVALID_PARAMETER"));
	}

	@Test
	@DisplayName("Sin radio ni viewport se devuelven todas las estaciones")
	void missingRadioWithoutBoundsReturnsAllStations() throws Exception {
		when(stationService.findNearby(eq(40.4168), eq(-3.7038), eq(null),
				eq(null), eq(FuelType.GASOLINA_95), any(), anyInt(), isNull(), isNull(), isNull(), any()))
				.thenReturn(List.of(
						new NearbyStationDto("9", "BALLENOIL", "DIR", "Madrid", "Madrid",
								41.0, -2.0, 350.0, new BigDecimal("1.599"),
								new BigDecimal("0.000"), "17/08/2026")
				));

		mockMvc.perform(get("/api/stations/nearby")
						.param("lat", "40.4168")
						.param("lon", "-3.7038")
						.param("combustible", "GASOLINA_95"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$[0].id").value("9"))
				.andExpect(jsonPath("$[0].distanciaKm").value(350.0));
	}

	@Test
	@DisplayName("Con viewport no hace falta latitud ni longitud (se usa el centro del rectángulo)")
	void viewportWithoutCoordinatesUsesBoundsCenter() throws Exception {
		// Centro del rectángulo: lat 40, lon -3.5.
		when(stationService.findNearby(eq(40.0), eq(-3.5), eq(null),
				org.mockito.ArgumentMatchers.argThat((StationService.Bounds b) ->
						b != null && b.minLat() == 36.0 && b.maxLat() == 44.0
								&& b.minLon() == -10.0 && b.maxLon() == 3.0),
				eq(FuelType.GASOLINA_95), any(), anyInt(), isNull(), isNull(), isNull(), any()))
				.thenReturn(List.of());

		mockMvc.perform(get("/api/stations/nearby")
						.param("combustible", "GASOLINA_95")
						.param("minLat", "36")
						.param("maxLat", "44")
						.param("minLon", "-10")
						.param("maxLon", "3"))
				.andExpect(status().isOk());
	}

	@Test
	@DisplayName("Combinar radio y viewport devuelve 400")
	void radioWithBoundsReturns400() throws Exception {
		mockMvc.perform(get("/api/stations/nearby")
						.param("lat", "40.4168")
						.param("lon", "-3.7038")
						.param("radio", "10")
						.param("combustible", "GASOLINA_95")
						.param("minLat", "36")
						.param("maxLat", "44")
						.param("minLon", "-10")
						.param("maxLon", "3"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("INVALID_PARAMETER"));
	}

	@Test
	@DisplayName("Límite cero devuelve 400")
	void zeroLimitReturns400() throws Exception {
		mockMvc.perform(get("/api/stations/nearby")
						.param("lat", "40.4168")
						.param("lon", "-3.7038")
						.param("radio", "10")
						.param("combustible", "GASOLINA_95")
						.param("limit", "0"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("INVALID_PARAMETER"));
	}

	@Test
	@DisplayName("Límite negativo devuelve 400")
	void negativeLimitReturns400() throws Exception {
		mockMvc.perform(get("/api/stations/nearby")
						.param("lat", "40.4168")
						.param("lon", "-3.7038")
						.param("radio", "10")
						.param("combustible", "GASOLINA_95")
						.param("limit", "-3"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("INVALID_PARAMETER"));
	}

	@Test
	@DisplayName("Límite superior al máximo (500) devuelve 400")
	void limitOverMaxReturns400() throws Exception {
		mockMvc.perform(get("/api/stations/nearby")
						.param("lat", "40.4168")
						.param("lon", "-3.7038")
						.param("radio", "10")
						.param("combustible", "GASOLINA_95")
						.param("limit", "501"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("INVALID_PARAMETER"));
	}

	@Test
	@DisplayName("Límite no numérico devuelve 400")
	void nonNumericLimitReturns400() throws Exception {
		mockMvc.perform(get("/api/stations/nearby")
						.param("lat", "40.4168")
						.param("lon", "-3.7038")
						.param("radio", "10")
						.param("combustible", "GASOLINA_95")
						.param("limit", "muchos"))
				.andExpect(status().isBadRequest());
	}

	@Test
	@DisplayName("Un límite válido llega al servicio y acota el resultado")
	void validLimitReachesService() throws Exception {
		when(stationService.findNearby(eq(40.4168), eq(-3.7038), eq(10.0),
				eq(null), eq(FuelType.GASOLINA_95), any(), eq(2), isNull(), isNull(), isNull(), any()))
				.thenReturn(List.of());

		mockMvc.perform(get("/api/stations/nearby")
						.param("lat", "40.4168")
						.param("lon", "-3.7038")
						.param("radio", "10")
						.param("combustible", "GASOLINA_95")
						.param("limit", "2"))
				.andExpect(status().isOk());

		org.mockito.Mockito.verify(stationService).findNearby(
				eq(40.4168), eq(-3.7038), eq(10.0), eq(null),
				eq(FuelType.GASOLINA_95), any(), eq(2), isNull(), isNull(), isNull(), any());
	}

	@Test
	@DisplayName("Con radio y sin límite se piden todas las estaciones del rango")
	void radioWithoutLimitPassesNullToService() throws Exception {
		when(stationService.findNearby(eq(40.4168), eq(-3.7038), eq(10.0),
				isNull(), eq(FuelType.GASOLINA_95), any(), isNull(), isNull(), isNull(), isNull(), any()))
				.thenReturn(List.of());

		mockMvc.perform(get("/api/stations/nearby")
						.param("lat", "40.4168")
						.param("lon", "-3.7038")
						.param("radio", "10")
						.param("combustible", "GASOLINA_95"))
				.andExpect(status().isOk());

		org.mockito.Mockito.verify(stationService).findNearby(
				eq(40.4168), eq(-3.7038), eq(10.0), isNull(),
				eq(FuelType.GASOLINA_95), any(), isNull(), isNull(), isNull(), isNull(), any());
	}

	@Test
	@DisplayName("Con viewport y sin límite se aplica el límite por defecto de 500")
	void boundsWithoutLimitAppliesDefaultLimit() throws Exception {
		when(stationService.findNearby(eq(40.4168), eq(-3.7038), isNull(),
				any(), eq(FuelType.GASOLINA_95), any(), eq(500), isNull(), isNull(), isNull(), any()))
				.thenReturn(List.of());

		mockMvc.perform(get("/api/stations/nearby")
						.param("lat", "40.4168")
						.param("lon", "-3.7038")
						.param("minLat", "40.0")
						.param("maxLat", "41.0")
						.param("minLon", "-4.0")
						.param("maxLon", "-3.5")
						.param("combustible", "GASOLINA_95"))
				.andExpect(status().isOk());

		org.mockito.Mockito.verify(stationService).findNearby(
				eq(40.4168), eq(-3.7038), isNull(), any(),
				eq(FuelType.GASOLINA_95), any(), eq(500), isNull(), isNull(), isNull(), any());
	}

	@Test
	@DisplayName("Un offset válido llega al servicio para paginar el viewport")
	void validOffsetReachesService() throws Exception {
		when(stationService.findNearby(eq(40.4168), eq(-3.7038), isNull(),
				any(), eq(FuelType.GASOLINA_95), any(), eq(500), eq(500), isNull(), isNull(), any()))
				.thenReturn(List.of());

		mockMvc.perform(get("/api/stations/nearby")
						.param("lat", "40.4168")
						.param("lon", "-3.7038")
						.param("combustible", "GASOLINA_95")
						.param("minLat", "40.0")
						.param("maxLat", "41.0")
						.param("minLon", "-4.0")
						.param("maxLon", "-3.5")
						.param("offset", "500"))
				.andExpect(status().isOk());

		org.mockito.Mockito.verify(stationService).findNearby(
				eq(40.4168), eq(-3.7038), isNull(), any(),
				eq(FuelType.GASOLINA_95), any(), eq(500), eq(500), isNull(), isNull(), any());
	}

	@Test
	@DisplayName("Un rango de precio llega al servicio para filtrar")
	void priceRangeReachesService() throws Exception {
		when(stationService.findNearby(eq(40.4168), eq(-3.7038), isNull(),
				any(), eq(FuelType.GASOLINA_95), any(), eq(500), isNull(), eq(1.4), eq(1.8), any()))
				.thenReturn(List.of());

		mockMvc.perform(get("/api/stations/nearby")
						.param("lat", "40.4168")
						.param("lon", "-3.7038")
						.param("combustible", "GASOLINA_95")
						.param("minLat", "40.0")
						.param("maxLat", "41.0")
						.param("minLon", "-4.0")
						.param("maxLon", "-3.5")
						.param("minPrecio", "1.4")
						.param("maxPrecio", "1.8"))
				.andExpect(status().isOk());

		org.mockito.Mockito.verify(stationService).findNearby(
				eq(40.4168), eq(-3.7038), isNull(), any(),
				eq(FuelType.GASOLINA_95), any(), eq(500), isNull(), eq(1.4), eq(1.8), any());
	}

	@Test
	@DisplayName("Un rango de precio invertido devuelve 400")
	void invertedPriceRangeReturns400() throws Exception {
		mockMvc.perform(get("/api/stations/nearby")
						.param("lat", "40.4168")
						.param("lon", "-3.7038")
						.param("combustible", "GASOLINA_95")
						.param("minPrecio", "1.8")
						.param("maxPrecio", "1.4"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("INVALID_PARAMETER"));
	}

	@Test
	@DisplayName("Una marca desconocida devuelve 400")
	void unknownBrandReturns400() throws Exception {
		mockMvc.perform(get("/api/stations/nearby")
						.param("lat", "40.4168")
						.param("lon", "-3.7038")
						.param("radio", "10")
						.param("combustible", "GASOLINA_95")
						.param("marcas", "mitica"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("INVALID_PARAMETER"));
	}

	@Test
	@DisplayName("Un filtro de marcas válido llega al servicio")
	void validBrandsReachService() throws Exception {
		when(stationService.findNearby(eq(40.4168), eq(-3.7038), eq(10.0),
				eq(null), eq(FuelType.GASOLINA_95), any(), isNull(), isNull(), isNull(), isNull(),
				eq(List.of("repsol", "otras"))))
				.thenReturn(List.of());

		mockMvc.perform(get("/api/stations/nearby")
						.param("lat", "40.4168")
						.param("lon", "-3.7038")
						.param("radio", "10")
						.param("combustible", "GASOLINA_95")
						.param("marcas", "repsol, otras"))
				.andExpect(status().isOk());

		org.mockito.Mockito.verify(stationService).findNearby(
				eq(40.4168), eq(-3.7038), eq(10.0), eq(null),
				eq(FuelType.GASOLINA_95), any(), isNull(), isNull(), isNull(), isNull(),
				eq(List.of("repsol", "otras")));
	}

	@Test
	@DisplayName("El endpoint de marcas devuelve el catálogo con conteos")
	void brandsEndpointReturnsCatalog() throws Exception {
		when(stationService.listBrands()).thenReturn(List.of(
				new com.example.gasolineras_api.dto.BrandDto("repsol", "Repsol", 42),
				new com.example.gasolineras_api.dto.BrandDto("otras", "Otras marcas", 91)));

		mockMvc.perform(get("/api/stations/brands"))
				.andExpect(status().isOk())
				.andExpect(header().string("Cache-Control", "no-cache"))
				.andExpect(jsonPath("$[0].code").value("repsol"))
				.andExpect(jsonPath("$[0].label").value("Repsol"))
				.andExpect(jsonPath("$[0].count").value(42))
				.andExpect(jsonPath("$[1].code").value("otras"));
	}

	@Test
	@DisplayName("El endpoint de rango de precios devuelve el mínimo y máximo globales")
	void priceRangeEndpointReturnsRange() throws Exception {
		when(stationService.priceRangeOverall())
				.thenReturn(new PriceRangeDto(new BigDecimal("1.400"), new BigDecimal("1.900")));

		mockMvc.perform(get("/api/stations/nearby/price-range"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.min").value(1.4))
				.andExpect(jsonPath("$.max").value(1.9));
	}

	@Test
	@DisplayName("El mapa devuelve el conjunto ligero completo con caché pública corta")
	void mapEndpointReturnsLightweightStations() throws Exception {
		when(stationService.findAllForMap(FuelType.DIESEL, null, null, List.of()))
				.thenReturn(List.of(new MapStationDto(
						"1", "REPSOL", 40.4168, -3.7038,
						new BigDecimal("1.499"), true, "2026-08-22T10:00:00")));

		mockMvc.perform(get("/api/stations/map")
						.param("combustible", "DIESEL"))
				.andExpect(status().isOk())
				.andExpect(header().string("Cache-Control", containsString("max-age=300")))
				.andExpect(header().string("Cache-Control", containsString("public")))
				.andExpect(jsonPath("$[0].id").value("1"))
				.andExpect(jsonPath("$[0].rotulo").value("REPSOL"))
				.andExpect(jsonPath("$[0].latitud").value(40.4168))
				.andExpect(jsonPath("$[0].precio").value(1.499))
				.andExpect(jsonPath("$[0].mejorOpcion").value(true));
	}

	@Test
	@DisplayName("El mapa aplica precio y marcas sin admitir valores desconocidos")
	void mapEndpointValidatesAndForwardsFilters() throws Exception {
		when(stationService.findAllForMap(FuelType.GASOLINA_95, 1.4, 1.8,
				List.of("repsol", "otras"))).thenReturn(List.of());

		mockMvc.perform(get("/api/stations/map")
						.param("combustible", "GASOLINA_95")
						.param("minPrecio", "1.4")
						.param("maxPrecio", "1.8")
						.param("marcas", "repsol,otras"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$").isEmpty());

		org.mockito.Mockito.verify(stationService).findAllForMap(
				FuelType.GASOLINA_95, 1.4, 1.8, List.of("repsol", "otras"));

		mockMvc.perform(get("/api/stations/map")
						.param("combustible", "DIESEL")
						.param("marcas", "inventada"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("INVALID_PARAMETER"));
	}

	@Test
	@DisplayName("El mapa rechaza rangos invertidos y precios no finitos")
	void mapEndpointRejectsInvalidPrices() throws Exception {
		mockMvc.perform(get("/api/stations/map")
						.param("combustible", "DIESEL")
						.param("minPrecio", "2")
						.param("maxPrecio", "1"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("INVALID_PARAMETER"));

		mockMvc.perform(get("/api/stations/map")
						.param("combustible", "DIESEL")
						.param("minPrecio", "NaN"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("INVALID_PARAMETER"));
	}

	@Test
	@DisplayName("Un offset negativo devuelve 400")
	void negativeOffsetReturns400() throws Exception {
		mockMvc.perform(get("/api/stations/nearby")
						.param("lat", "40.4168")
						.param("lon", "-3.7038")
						.param("combustible", "GASOLINA_95")
						.param("offset", "-1"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("INVALID_PARAMETER"));
	}

	@Test
	@DisplayName("Combustible desconocido devuelve 400")
	void unknownFuelTypeReturns400() throws Exception {
		mockMvc.perform(get("/api/stations/nearby")
						.param("lat", "40.4168")
						.param("lon", "-3.7038")
						.param("radio", "10")
						.param("combustible", "HIDROGENO"))
				.andExpect(status().isBadRequest());
	}

	@Test
	@DisplayName("Orden inválido devuelve 400")
	void invalidOrderReturns400() throws Exception {
		mockMvc.perform(get("/api/stations/nearby")
						.param("lat", "40.4168")
						.param("lon", "-3.7038")
						.param("radio", "10")
						.param("combustible", "GASOLINA_95")
						.param("orden", "alfabetico"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("INVALID_PARAMETER"));
	}

	@Test
	@DisplayName("Parámetros ausentes devuelven 400")
	void missingParametersReturn400() throws Exception {
		mockMvc.perform(get("/api/stations/nearby")
						.param("lat", "40.4168")
						.param("radio", "10")
						.param("combustible", "GASOLINA_95"))
				.andExpect(status().isBadRequest());
	}

	@Test
	@DisplayName("Una estación existente devuelve su ficha detallada")
	void existingStationReturnsDetail() throws Exception {
		com.example.gasolineras_api.domain.FuelType gas = com.example.gasolineras_api.domain.FuelType.GASOLINA_95;
		when(stationService.getStationDetail("1")).thenReturn(
				new com.example.gasolineras_api.dto.StationDetailDto(
						"1", "REPSOL", "CALLE MAYOR 1", "28001", "Madrid", "Madrid", "Madrid",
						40.4168, -3.7038, "L-D: 06:00-22:00", "P", "D",
						java.util.Map.of(gas, new BigDecimal("1.599")), "17/08/2026"));

		mockMvc.perform(get("/api/stations/1"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.id").value("1"))
				.andExpect(jsonPath("$.rotulo").value("REPSOL"))
				.andExpect(jsonPath("$.precios.GASOLINA_95").value(1.599));
	}

	@Test
	@DisplayName("Una estación inexistente devuelve 404")
	void missingStationReturns404() throws Exception {
		when(stationService.getStationDetail("999"))
				.thenThrow(new com.example.gasolineras_api.exception.ResourceNotFoundException(
						"La estación 999 no existe"));

		mockMvc.perform(get("/api/stations/999"))
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.code").value("NOT_FOUND"))
				.andExpect(jsonPath("$.message").value("La estación 999 no existe"));
	}
}
