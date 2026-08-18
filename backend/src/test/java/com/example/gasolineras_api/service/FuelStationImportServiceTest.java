package com.example.gasolineras_api.service;

import com.example.gasolineras_api.client.FuelStationDataClient;
import com.example.gasolineras_api.client.FuelStationDataClientException;
import com.example.gasolineras_api.client.dto.GeoportalResponse;
import com.example.gasolineras_api.client.dto.GeoportalStation;
import com.example.gasolineras_api.domain.FuelType;
import com.example.gasolineras_api.domain.NormalizedStation;
import com.example.gasolineras_api.mapper.GeoportalStationNormalizer;
import com.example.gasolineras_api.mapper.NormalizationResult;
import com.example.gasolineras_api.mapper.RejectedRecord;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class FuelStationImportServiceTest {

	private FuelStationDataClient client;
	private GeoportalStationNormalizer normalizer;
	private FuelStationPersistenceService persistence;
	private FuelStationImportService service;

	@BeforeEach
	void setUp() {
		client = mock(FuelStationDataClient.class);
		normalizer = mock(GeoportalStationNormalizer.class);
		persistence = mock(FuelStationPersistenceService.class);
		service = new FuelStationImportService(client, normalizer, persistence);
	}

	@Test
	@DisplayName("Una importación válida persiste los datos y devuelve éxito")
	void validImportPersistsAndReturnsSuccess() {
		var station = rawStation();
		var response = new GeoportalResponse("17/08/2026", "nota", List.of(station), "OK");
		var ns = normalizedStation();
		var normalized = new NormalizationResult("17/08/2026", List.of(ns), List.of());

		when(client.fetchAllStations()).thenReturn(response);
		when(normalizer.normalize(anyList(), anyString())).thenReturn(normalized);

		ImportResult result = service.runImport();

		assertThat(result.success()).isTrue();
		assertThat(result.stationsValid()).isEqualTo(1);
		assertThat(result.stationsRejected()).isEqualTo(0);
		verify(persistence).persist(any(NormalizationResult.class), any());
	}

	@Test
	@DisplayName("Una importación sin estaciones válidas no persiste")
	void importWithNoValidStationsDoesNotPersist() {
		var response = new GeoportalResponse("17/08/2026", "nota", List.of(), "OK");
		var normalized = new NormalizationResult("17/08/2026", List.of(),
				List.of(new RejectedRecord("1", "coordenada inválida")));

		when(client.fetchAllStations()).thenReturn(response);
		when(normalizer.normalize(anyList(), anyString())).thenReturn(normalized);

		ImportResult result = service.runImport();

		assertThat(result.success()).isTrue();
		assertThat(result.stationsRejected()).isEqualTo(1);
		verify(persistence, never()).persist(any(), any());
	}

	@Test
	@DisplayName("Un fallo del proveedor no persiste y devuelve fallo")
	void providerFailureDoesNotPersist() {
		when(client.fetchAllStations())
				.thenThrow(new FuelStationDataClientException("proveedor caído", true));

		ImportResult result = service.runImport();

		assertThat(result.success()).isFalse();
		assertThat(result.errorMessage()).isEqualTo("proveedor caído");
		verify(persistence, never()).persist(any(), any());
	}

	@Test
	@DisplayName("Un error de persistencia propaga la excepción")
	void persistenceErrorPropagates() {
		var response = new GeoportalResponse("17/08/2026", "nota", List.of(rawStation()), "OK");
		var normalized = new NormalizationResult("17/08/2026",
				List.of(normalizedStation()), List.of());

		when(client.fetchAllStations()).thenReturn(response);
		when(normalizer.normalize(anyList(), anyString())).thenReturn(normalized);
		org.mockito.Mockito.doThrow(new RuntimeException("db error"))
				.when(persistence).persist(any(), any());

		ImportResult result = service.runImport();

		assertThat(result.success()).isFalse();
		assertThat(result.errorMessage()).isEqualTo("db error");
	}

	@Test
	@DisplayName("La fecha de datos se pasa correctamente al normalizador")
	void dataDateIsPassedToNormalizer() {
		var response = new GeoportalResponse("17/08/2026 15:43:34", "nota", List.of(), "OK");
		var normalized = new NormalizationResult("17/08/2026 15:43:34", List.of(), List.of());

		when(client.fetchAllStations()).thenReturn(response);
		when(normalizer.normalize(anyList(), anyString())).thenReturn(normalized);

		service.runImport();

		ArgumentCaptor<String> captor = ArgumentCaptor.forClass(String.class);
		verify(normalizer).normalize(anyList(), captor.capture());
		assertThat(captor.getValue()).isEqualTo("17/08/2026 15:43:34");
	}

	private GeoportalStation rawStation() {
		return new GeoportalStation(
				"28001", "DIR", "L-D: 06:00-22:00", "40,4168",
				"Madrid", "-3,7038", "D", "Madrid",
				"1,749", "1,599", "1,699",
				"Madrid", "dm", "REPSOL", "P",
				"0,0", "0,0", "1", "52", "28", "07");
	}

	private NormalizedStation normalizedStation() {
		return new NormalizedStation(
				"1", "REPSOL", "repsol", "DIR", "28001", "Madrid", "Madrid", "Madrid",
				40.4168, -3.7038, "L-D: 06:00-22:00", "P", "D",
				Map.of(FuelType.GASOLINA_95, new BigDecimal("1.599")));
	}
}
