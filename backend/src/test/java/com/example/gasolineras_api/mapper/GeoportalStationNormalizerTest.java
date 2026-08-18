package com.example.gasolineras_api.mapper;

import com.example.gasolineras_api.client.dto.GeoportalStation;
import com.example.gasolineras_api.domain.FuelType;
import com.example.gasolineras_api.domain.NormalizedStation;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class GeoportalStationNormalizerTest {

	private GeoportalStationNormalizer normalizer;

	@BeforeEach
	void setUp() {
		normalizer = new GeoportalStationNormalizer();
	}

	@Test
	@DisplayName("Una estación válida se normaliza correctamente")
	void validStationIsNormalized() {
		var raw = station("1", "REPSOL", "1,599", "1,749", "1,699", "40,4168", "-3,7038");

		NormalizationResult result = normalizer.normalize(List.of(raw), "17/08/2026");

		assertThat(result.validStations()).hasSize(1);
		assertThat(result.rejectedRecords()).isEmpty();

		NormalizedStation s = result.validStations().getFirst();
		assertThat(s.id()).isEqualTo("1");
		assertThat(s.rotulo()).isEqualTo("REPSOL");
		assertThat(s.latitud()).isEqualTo(40.4168);
		assertThat(s.longitud()).isEqualTo(-3.7038);
		assertThat(s.precios()).containsEntry(FuelType.GASOLINA_95, new BigDecimal("1.599"));
		assertThat(s.precios()).containsEntry(FuelType.DIESEL, new BigDecimal("1.749"));
		assertThat(s.precios()).containsEntry(FuelType.GASOLINA_98, new BigDecimal("1.699"));
	}

	@Test
	@DisplayName("Una estación sin ID se rechaza")
	void stationWithoutIdIsRejected() {
		var raw = station(null, "REPSOL", "1,599", "1,749", "1,699", "40,4168", "-3,7038");

		NormalizationResult result = normalizer.normalize(List.of(raw), "17/08/2026");

		assertThat(result.validStations()).isEmpty();
		assertThat(result.rejectedRecords()).hasSize(1);
		assertThat(result.rejectedRecords().getFirst().stationId()).isEqualTo("desconocido");
	}

	@Test
	@DisplayName("Una estación con ID vacío se rechaza")
	void stationWithBlankIdIsRejected() {
		var raw = station("  ", "REPSOL", "1,599", "1,749", "1,699", "40,4168", "-3,7038");

		NormalizationResult result = normalizer.normalize(List.of(raw), "17/08/2026");

		assertThat(result.validStations()).isEmpty();
		assertThat(result.rejectedRecords()).hasSize(1);
	}

	@Test
	@DisplayName("Una estación con latitud vacía se rechaza")
	void stationWithEmptyLatitudeIsRejected() {
		var raw = station("1", "REPSOL", "1,599", "1,749", "1,699", "", "-3,7038");

		NormalizationResult result = normalizer.normalize(List.of(raw), "17/08/2026");

		assertThat(result.validStations()).isEmpty();
		assertThat(result.rejectedRecords()).hasSize(1);
	}

	@Test
	@DisplayName("Una estación con latitud fuera de rango se rechaza")
	void stationWithOutOfRangeLatitudeIsRejected() {
		var raw = station("1", "REPSOL", "1,599", "1,749", "1,699", "95,0", "-3,7038");

		NormalizationResult result = normalizer.normalize(List.of(raw), "17/08/2026");

		assertThat(result.validStations()).isEmpty();
		assertThat(result.rejectedRecords()).hasSize(1);
	}

	@Test
	@DisplayName("Una estación con coordenada no numérica se rechaza")
	void stationWithNonNumericCoordinateIsRejected() {
		var raw = station("1", "REPSOL", "1,599", "1,749", "1,699", "abc", "-3,7038");

		NormalizationResult result = normalizer.normalize(List.of(raw), "17/08/2026");

		assertThat(result.validStations()).isEmpty();
		assertThat(result.rejectedRecords()).hasSize(1);
	}

	@Test
	@DisplayName("Coordenadas (0, 0) del golfo de Guinea se rechazan (no son de España)")
	void zeroCoordinatesAreRejected() {
		var raw = station("1", "REPSOL", "1,599", "1,749", "1,699", "0,0", "0,0");

		NormalizationResult result = normalizer.normalize(List.of(raw), "17/08/2026");

		assertThat(result.validStations()).isEmpty();
		assertThat(result.rejectedRecords()).hasSize(1);
	}

	@Test
	@DisplayName("Coordenadas en el océano Índico (latitud/longitud intercambiadas) se rechazan")
	void swappedCoordinatesAreRejected() {
		// Una estación gallega con lat/lon intercambiadas cae junto a Comoras.
		var raw = station("1", "GUAY", "1,599", "1,749", "1,699", "-8,659", "42,037");

		NormalizationResult result = normalizer.normalize(List.of(raw), "17/08/2026");

		assertThat(result.validStations()).isEmpty();
		assertThat(result.rejectedRecords()).hasSize(1);
	}

	@Test
	@DisplayName("Coordenadas de Canarias se aceptan")
	void canariasCoordinatesAreAccepted() {
		var raw = station("1", "REPSOL", "1,599", "1,749", "1,699", "27,8", "-17,5");

		NormalizationResult result = normalizer.normalize(List.of(raw), "17/08/2026");

		assertThat(result.validStations()).hasSize(1);
		assertThat(result.rejectedRecords()).isEmpty();
	}

	@Test
	@DisplayName("Un precio negativo se ignora pero la estación es válida")
	void negativePriceIsIgnored() {
		var raw = station("1", "REPSOL", "-1,500", "1,749", "1,699", "40,4168", "-3,7038");

		NormalizationResult result = normalizer.normalize(List.of(raw), "17/08/2026");

		assertThat(result.validStations()).hasSize(1);
		assertThat(result.rejectedRecords()).isEmpty();
		assertThat(result.validStations().getFirst().precios()).doesNotContainKey(FuelType.GASOLINA_95);
		assertThat(result.validStations().getFirst().precios()).containsEntry(FuelType.DIESEL, new BigDecimal("1.749"));
	}

	@Test
	@DisplayName("Un precio con formato inválido se ignora pero la estación es válida")
	void malformedPriceIsIgnored() {
		var raw = station("1", "REPSOL", "abc", "1,749", "1,699", "40,4168", "-3,7038");

		NormalizationResult result = normalizer.normalize(List.of(raw), "17/08/2026");

		assertThat(result.validStations()).hasSize(1);
		assertThat(result.validStations().getFirst().precios()).doesNotContainKey(FuelType.GASOLINA_95);
		assertThat(result.validStations().getFirst().precios()).containsEntry(FuelType.DIESEL, new BigDecimal("1.749"));
	}

	@Test
	@DisplayName("Un precio vacío se ignora (precio no disponible)")
	void emptyPriceIsIgnored() {
		var raw = station("1", "REPSOL", "", "1,749", "", "40,4168", "-3,7038");

		NormalizationResult result = normalizer.normalize(List.of(raw), "17/08/2026");

		assertThat(result.validStations()).hasSize(1);
		assertThat(result.validStations().getFirst().precios()).doesNotContainKey(FuelType.GASOLINA_95);
		assertThat(result.validStations().getFirst().precios()).doesNotContainKey(FuelType.GASOLINA_98);
		assertThat(result.validStations().getFirst().precios()).containsEntry(FuelType.DIESEL, new BigDecimal("1.749"));
	}

	@Test
	@DisplayName("Mezcla de estaciones válidas e inválidas: las válidas se procesan, las inválidas se rechazan")
	void mixOfValidAndInvalidStations() {
		var valid = station("1", "REPSOL", "1,599", "1,749", "1,699", "40,4168", "-3,7038");
		var noId = station(null, "CEPSA", "1,599", "1,749", "1,699", "40,4168", "-3,7038");
		var badCoord = station("2", "BP", "1,599", "1,749", "1,699", "abc", "-3,7038");
		var valid2 = station("3", "SHELL", "1,609", "1,759", "1,709", "41,3851", "2,1734");

		NormalizationResult result = normalizer.normalize(List.of(valid, noId, badCoord, valid2), "17/08/2026");

		assertThat(result.validStations()).hasSize(2);
		assertThat(result.validStations().get(0).id()).isEqualTo("1");
		assertThat(result.validStations().get(1).id()).isEqualTo("3");
		assertThat(result.rejectedRecords()).hasSize(2);
	}

	@Test
	@DisplayName("La fecha de actualización se propaga al resultado")
	void fechaActualizacionIsPropagated() {
		var raw = station("1", "REPSOL", "1,599", "1,749", "1,699", "40,4168", "-3,7038");

		NormalizationResult result = normalizer.normalize(List.of(raw), "17/08/2026 15:43:34");

		assertThat(result.fechaActualizacion()).isEqualTo("17/08/2026 15:43:34");
	}

	@Test
	@DisplayName("Una lista vacía devuelve resultado vacío")
	void emptyListReturnsEmptyResult() {
		NormalizationResult result = normalizer.normalize(List.of(), "17/08/2026");

		assertThat(result.validStations()).isEmpty();
		assertThat(result.rejectedRecords()).isEmpty();
	}

	@Test
	@DisplayName("Las coordenadas con coma decimal se parsean correctamente")
	void commaDecimalCoordinatesAreParsed() {
		var raw = station("1", "REPSOL", "1,599", "1,749", "1,699", "39,211417", "-1,539167");

		NormalizationResult result = normalizer.normalize(List.of(raw), "17/08/2026");

		NormalizedStation s = result.validStations().getFirst();
		assertThat(s.latitud()).isEqualTo(39.211417);
		assertThat(s.longitud()).isEqualTo(-1.539167);
	}

	@Test
	@DisplayName("Los campos de texto se copian tal cual")
	void textFieldsAreCopiedAsIs() {
		var raw = new GeoportalStation(
				"28001", "CALLE MAYOR 1", "L-D: 06:00-22:00", "40,4168",
				"Madrid", "-3,7038", "D", "Madrid",
				"1,749", "1,599", "1,699",
				"Madrid", "dm", "REPSOL", "P",
				"0,0", "0,0",
				"1", "52", "28", "07"
		);

		NormalizationResult result = normalizer.normalize(List.of(raw), "17/08/2026");

		NormalizedStation s = result.validStations().getFirst();
		assertThat(s.direccion()).isEqualTo("CALLE MAYOR 1");
		assertThat(s.horario()).isEqualTo("L-D: 06:00-22:00");
		assertThat(s.codigoPostal()).isEqualTo("28001");
		assertThat(s.localidad()).isEqualTo("Madrid");
		assertThat(s.municipio()).isEqualTo("Madrid");
		assertThat(s.provincia()).isEqualTo("Madrid");
		assertThat(s.tipoVenta()).isEqualTo("P");
		assertThat(s.margen()).isEqualTo("D");
	}

	@Test
	@DisplayName("Una estación sin ningún precio es válida (precios vacíos)")
	void stationWithNoPricesIsValid() {
		var raw = station("1", "REPSOL", "", "", "", "40,4168", "-3,7038");

		NormalizationResult result = normalizer.normalize(List.of(raw), "17/08/2026");

		assertThat(result.validStations()).hasSize(1);
		assertThat(result.validStations().getFirst().precios()).isEmpty();
	}

	private GeoportalStation station(String id, String rotulo, String gasolina95,
			String gasoleoA, String gasolina98, String latitud, String longitud) {
		return new GeoportalStation(
				"28001", "DIRECCIÓN", "L-D: 06:00-22:00", latitud,
				"Localidad", longitud, "D", "Municipio",
				gasoleoA, gasolina95, gasolina98,
				"Provincia", "dm", rotulo, "P",
				"0,0", "0,0",
				id, "1", "28", "07"
		);
	}
}
