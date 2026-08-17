package com.example.gasolineras_api.controller;

import com.example.gasolineras_api.domain.FuelType;
import com.example.gasolineras_api.dto.NearbyStationDto;
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
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

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
				eq(FuelType.GASOLINA_95), any()))
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
	@DisplayName("Radio superior al máximo devuelve 400")
	void radiusOverMaxReturns400() throws Exception {
		mockMvc.perform(get("/api/stations/nearby")
						.param("lat", "40.4168")
						.param("lon", "-3.7038")
						.param("radio", "100")
						.param("combustible", "GASOLINA_95"))
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
