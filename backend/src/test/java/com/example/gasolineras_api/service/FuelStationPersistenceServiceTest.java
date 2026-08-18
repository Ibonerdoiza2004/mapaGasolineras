package com.example.gasolineras_api.service;

import com.example.gasolineras_api.domain.FuelType;
import com.example.gasolineras_api.domain.NormalizedStation;
import com.example.gasolineras_api.domain.PriceSnapshot;
import com.example.gasolineras_api.domain.Station;
import com.example.gasolineras_api.mapper.NormalizationResult;
import com.example.gasolineras_api.repository.CurrentPriceRepository;
import com.example.gasolineras_api.repository.PriceSnapshotRepository;
import com.example.gasolineras_api.repository.StationRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(properties = "app.municipios.import-enabled=false")
class FuelStationPersistenceServiceTest {

	@Autowired
	private FuelStationPersistenceService persistence;

	@Autowired
	private StationRepository stationRepository;

	@Autowired
	private CurrentPriceRepository currentPriceRepository;

	@Autowired
	private PriceSnapshotRepository priceSnapshotRepository;

	@BeforeEach
	void cleanDatabase() {
		priceSnapshotRepository.deleteAll();
		currentPriceRepository.deleteAll();
		stationRepository.deleteAll();
	}

	@Test
	@DisplayName("Una estación nueva se persiste correctamente")
	void newStationIsPersisted() {
		var normalized = result(station("1", "REPSOL"));

		persistence.persist(normalized, Instant.now());

		assertThat(stationRepository.findByOfficialId("1")).isPresent();
		assertThat(stationRepository.findByOfficialId("1").get().getRotulo()).isEqualTo("REPSOL");
	}

	@Test
	@DisplayName("Una estación existente se actualiza (no se duplica)")
	void existingStationIsUpdated() {
		persistence.persist(result(station("1", "REPSOL")), Instant.now());
		persistence.persist(result(station("1", "CEPSA")), Instant.now());

		assertThat(stationRepository.count()).isEqualTo(1);
		assertThat(stationRepository.findByOfficialId("1").get().getRotulo()).isEqualTo("CEPSA");
	}

	@Test
	@DisplayName("Un precio actual se actualiza (no se duplica)")
	void currentPriceIsUpdated() {
		var ns1 = station("1", "REPSOL");
		ns1.precios().put(FuelType.GASOLINA_95, new BigDecimal("1.500"));
		persistence.persist(result(ns1), Instant.now());

		var ns2 = station("1", "REPSOL");
		ns2.precios().put(FuelType.GASOLINA_95, new BigDecimal("1.600"));
		persistence.persist(result(ns2), Instant.now());

		Station s = stationRepository.findByOfficialId("1").get();
		var price = currentPriceRepository.findByStationAndFuelType(s, FuelType.GASOLINA_95);
		assertThat(price).isPresent();
		assertThat(price.get().getPrice()).isEqualByComparingTo(new BigDecimal("1.600"));
	}

	@Test
	@DisplayName("Reimportar la misma fecha no duplica snapshots")
	void sameDataDateDoesNotDuplicateSnapshots() {
		var normalized = resultWithDate(station("1", "REPSOL"), "17/08/2026");
		persistence.persist(normalized, Instant.now());
		persistence.persist(normalized, Instant.now());

		List<PriceSnapshot> snapshots = priceSnapshotRepository
				.findByStationOfficialIdOrderByRecordedAtDesc("1");
		assertThat(snapshots).hasSize(1);
	}

	@Test
	@DisplayName("Fechas de datos diferentes crean snapshots separados")
	void differentDataDatesCreateSeparateSnapshots() {
		persistence.persist(resultWithDate(station("1", "REPSOL"), "17/08/2026"), Instant.now());
		persistence.persist(resultWithDate(station("1", "REPSOL"), "18/08/2026"), Instant.now());

		List<PriceSnapshot> snapshots = priceSnapshotRepository
				.findByStationOfficialIdOrderByRecordedAtDesc("1");
		assertThat(snapshots).hasSize(2);
	}

	private NormalizedStation station(String id, String rotulo) {
		Map<FuelType, BigDecimal> precios = new java.util.HashMap<>();
		precios.put(FuelType.GASOLINA_95, new BigDecimal("1.599"));
		return new NormalizedStation(
				id, rotulo, com.example.gasolineras_api.mapper.BrandCatalog.normalize(rotulo),
				"DIR", "28001", "Madrid", "Madrid", "Madrid",
				40.4168, -3.7038, "L-D: 06:00-22:00", "P", "D", precios);
	}

	private NormalizationResult result(NormalizedStation ns) {
		return new NormalizationResult("17/08/2026", List.of(ns), List.of());
	}

	private NormalizationResult resultWithDate(NormalizedStation ns, String dataDate) {
		return new NormalizationResult(dataDate, List.of(ns), List.of());
	}
}
