package com.example.gasolineras_api.controller;

import com.example.gasolineras_api.client.GeocodeClientException;
import com.example.gasolineras_api.dto.GeocodeSuggestionDto;
import com.example.gasolineras_api.exception.GeocodeRateLimitException;
import com.example.gasolineras_api.exception.GlobalExceptionHandler;
import com.example.gasolineras_api.service.GeocodeService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.List;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class GeocodeControllerTest {

	private GeocodeService geocodeService;
	private MockMvc mockMvc;

	@BeforeEach
	void setUp() {
		geocodeService = mock(GeocodeService.class);
		GeocodeController controller = new GeocodeController(geocodeService);
		mockMvc = MockMvcBuilders.standaloneSetup(controller)
				.setControllerAdvice(new GlobalExceptionHandler())
				.build();
	}

	@Test
	@DisplayName("Una consulta válida devuelve las sugerencias de geocodificación")
	void validQueryReturnsSuggestions() throws Exception {
		when(geocodeService.search("madrid")).thenReturn(List.of(
				new GeocodeSuggestionDto("230445241", "Madrid", "Madrid, Comunidad de Madrid, España",
						"city", 40.4168, -3.7038)));

		mockMvc.perform(get("/api/geocode/search")
						.param("q", "madrid")
						.contentType(MediaType.APPLICATION_JSON))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$[0].id").value("230445241"))
				.andExpect(jsonPath("$[0].label").value("Madrid"))
				.andExpect(jsonPath("$[0].latitud").value(40.4168))
				.andExpect(jsonPath("$[0].longitud").value(-3.7038));
	}

	@Test
	@DisplayName("Una consulta demasiado corta devuelve 400")
	void tooShortQueryReturns400() throws Exception {
		mockMvc.perform(get("/api/geocode/search").param("q", "ab"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("INVALID_PARAMETER"))
				.andExpect(jsonPath("$.details.q").value("Escribe al menos 3 caracteres para buscar"));
	}

	@Test
	@DisplayName("Una consulta en blanco devuelve 400")
	void blankQueryReturns400() throws Exception {
		mockMvc.perform(get("/api/geocode/search").param("q", "   "))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("INVALID_PARAMETER"));
	}

	@Test
	@DisplayName("Una consulta demasiado larga devuelve 400")
	void tooLongQueryReturns400() throws Exception {
		String longQuery = "a".repeat(121);
		mockMvc.perform(get("/api/geocode/search").param("q", longQuery))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("INVALID_PARAMETER"))
				.andExpect(jsonPath("$.details.q").value("La consulta no puede superar 120 caracteres"));
	}

	@Test
	@DisplayName("Una consulta ausente devuelve 400")
	void missingQueryReturns400() throws Exception {
		mockMvc.perform(get("/api/geocode/search"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
	}

	@Test
	@DisplayName("Un fallo del geocodificador devuelve 503")
	void providerFailureReturns503() throws Exception {
		when(geocodeService.search(anyString())).thenThrow(
				new GeocodeClientException("No se pudo conectar con el proveedor", true));

		mockMvc.perform(get("/api/geocode/search").param("q", "madrid"))
				.andExpect(status().isServiceUnavailable())
				.andExpect(jsonPath("$.code").value("GEOCODE_UNAVAILABLE"))
				.andExpect(jsonPath("$.message").value(
						"El servicio de geocodificación no está disponible ahora mismo"));
	}

	@Test
	@DisplayName("Un límite de uso alcanzado devuelve 429")
	void rateLimitReturns429() throws Exception {
		when(geocodeService.search(anyString())).thenThrow(
				new GeocodeRateLimitException("Límite alcanzado"));

		mockMvc.perform(get("/api/geocode/search").param("q", "madrid"))
				.andExpect(status().isTooManyRequests())
				.andExpect(jsonPath("$.code").value("RATE_LIMITED"));
	}
}