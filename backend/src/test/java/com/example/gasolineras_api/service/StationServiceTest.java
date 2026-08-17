package com.example.gasolineras_api.service;

import com.example.gasolineras_api.domain.FuelType;
import com.example.gasolineras_api.dto.NearbyStationDto;
import com.example.gasolineras_api.exception.ResourceNotFoundException;
import com.example.gasolineras_api.repository.CurrentPriceRepository;
import com.example.gasolineras_api.repository.NearbyStationProjection;
import com.example.gasolineras_api.repository.StationRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class StationServiceTest {

	private StationRepository stationRepository;
	private CurrentPriceRepository currentPriceRepository;
	private StationService service;

	@BeforeEach
	void setUp() {
		stationRepository = mock(StationRepository.class);
		currentPriceRepository = mock(CurrentPriceRepository.class);
		service = new StationService(stationRepository, currentPriceRepository);
	}

	@Test
	@DisplayName("Devuelve estaciones ordenadas por precio con distancia y ahorro")
	void returnsStationsOrderedByPriceWithDistanceAndSavings() {
		when(stationRepository.findNearby(eq(40.4168), eq(-3.7038), eq(10000.0), eq("GASOLINA_95")))
				.thenReturn(List.of(
						projection("1", "REPSOL", 1.799, 5.0),
						projection("2", "CEPSA", 1.650, 8.0),
						projection("3", "BP", 1.700, 12.0)
				));

		List<NearbyStationDto> result = service.findNearby(
				40.4168, -3.7038, 10.0, FuelType.GASOLINA_95, StationService.OrderBy.PRECIO);

		assertThat(result).hasSize(3);
		assertThat(result.get(0).id()).isEqualTo("2");
		assertThat(result.get(0).precio()).isEqualByComparingTo(new BigDecimal("1.650"));
		assertThat(result.get(0).ahorro()).isEqualByComparingTo(new BigDecimal("0.000"));
		assertThat(result.get(1).id()).isEqualTo("3");
		assertThat(result.get(1).ahorro()).isEqualByComparingTo(new BigDecimal("0.050"));
		assertThat(result.get(2).id()).isEqualTo("1");
		assertThat(result.get(2).ahorro()).isEqualByComparingTo(new BigDecimal("0.149"));
	}

	@Test
	@DisplayName("Ordena por distancia cuando se solicita")
	void ordersByDistance() {
		when(stationRepository.findNearby(eq(40.4168), eq(-3.7038), eq(10000.0), eq("DIESEL")))
				.thenReturn(List.of(
						projection("1", "REPSOL", 1.799, 5.0),
						projection("2", "CEPSA", 1.650, 8.0),
						projection("3", "BP", 1.700, 1.0)
				));

		List<NearbyStationDto> result = service.findNearby(
				40.4168, -3.7038, 10.0, FuelType.DIESEL, StationService.OrderBy.DISTANCIA);

		assertThat(result).hasSize(3);
		assertThat(result.get(0).id()).isEqualTo("3");
		assertThat(result.get(0).distanciaKm()).isEqualTo(1.0);
	}

	@Test
	@DisplayName("Ordena por ahorro cuando se solicita")
	void ordersBySavings() {
		when(stationRepository.findNearby(eq(40.4168), eq(-3.7038), eq(10000.0), eq("GASOLINA_98")))
				.thenReturn(List.of(
						projection("1", "REPSOL", 1.799, 5.0),
						projection("2", "CEPSA", 1.650, 8.0),
						projection("3", "BP", 1.700, 1.0)
				));

		List<NearbyStationDto> result = service.findNearby(
				40.4168, -3.7038, 10.0, FuelType.GASOLINA_98, StationService.OrderBy.AHORRO);

		assertThat(result).hasSize(3);
		assertThat(result.get(0).id()).isEqualTo("2");
		assertThat(result.get(1).id()).isEqualTo("3");
		assertThat(result.get(2).id()).isEqualTo("1");
	}

	@Test
	@DisplayName("Una estación sin precio no se recomienda como mejor opción")
	void stationWithoutPriceHasNullSavings() {
		when(stationRepository.findNearby(eq(40.4168), eq(-3.7038), eq(10000.0), eq("GASOLINA_95")))
				.thenReturn(List.of(
						projection("1", "REPSOL", 1.799, 5.0),
						projectionWithoutPrice("2", "CEPSA", 8.0)
				));

		List<NearbyStationDto> result = service.findNearby(
				40.4168, -3.7038, 10.0, FuelType.GASOLINA_95, StationService.OrderBy.PRECIO);

		assertThat(result).hasSize(2);
		NearbyStationDto noPrice = result.stream()
				.filter(s -> s.id().equals("2"))
				.findFirst()
				.orElseThrow();
		assertThat(noPrice.precio()).isNull();
		assertThat(noPrice.ahorro()).isNull();
	}

	@Test
	@DisplayName("Convierte los metros a kilómetros correctamente")
	void convertsRadiusToMeters() {
		when(stationRepository.findNearby(eq(40.4168), eq(-3.7038), eq(5000.0), eq("DIESEL")))
				.thenReturn(List.of());

		service.findNearby(40.4168, -3.7038, 5.0, FuelType.DIESEL, StationService.OrderBy.PRECIO);

		// Verifica que se llamó con 5000 metros
		org.mockito.Mockito.verify(stationRepository)
				.findNearby(40.4168, -3.7038, 5000.0, "DIESEL");
	}

	@Test
	@DisplayName("El detalle de una estación existente devuelve todos los campos")
	void existingStationDetailReturnsAllFields() {
		var station = new com.example.gasolineras_api.domain.Station(
				"1", "REPSOL", "CALLE MAYOR 1", "28001",
				"Madrid", "Madrid", "Madrid", point(-3.7038, 40.4168),
				"L-D: 06:00-22:00", "P", "D", "17/08/2026",
				java.time.Instant.now());
		when(stationRepository.findById("1")).thenReturn(java.util.Optional.of(station));
		when(currentPriceRepository.findByStation(station)).thenReturn(List.of(
				new com.example.gasolineras_api.domain.CurrentPrice(
						station, FuelType.GASOLINA_95, new BigDecimal("1.599"), java.time.Instant.now()),
				new com.example.gasolineras_api.domain.CurrentPrice(
						station, FuelType.DIESEL, new BigDecimal("1.749"), java.time.Instant.now())
		));

		var detail = service.getStationDetail("1");

		assertThat(detail.id()).isEqualTo("1");
		assertThat(detail.rotulo()).isEqualTo("REPSOL");
		assertThat(detail.direccion()).isEqualTo("CALLE MAYOR 1");
		assertThat(detail.horario()).isEqualTo("L-D: 06:00-22:00");
		assertThat(detail.tipoVenta()).isEqualTo("P");
		assertThat(detail.margen()).isEqualTo("D");
		assertThat(detail.precios())
				.containsEntry(FuelType.GASOLINA_95, new BigDecimal("1.599"))
				.containsEntry(FuelType.DIESEL, new BigDecimal("1.749"));
		assertThat(detail.fechaActualizacion()).isEqualTo("17/08/2026");
	}

	@Test
	@DisplayName("El detalle de una estación inexistente lanza ResourceNotFoundException")
	void missingStationDetailThrowsNotFound() {
		when(stationRepository.findById("999")).thenReturn(java.util.Optional.empty());

		assertThatThrownBy(() -> service.getStationDetail("999"))
				.isInstanceOf(ResourceNotFoundException.class);
	}

	@Test
	@DisplayName("Una estación sin precios devuelve precios vacíos")
	void stationWithoutPricesReturnsEmptyPrices() {
		var station = new com.example.gasolineras_api.domain.Station(
				"1", "REPSOL", "DIR", "28001",
				"Madrid", "Madrid", "Madrid", point(-3.7038, 40.4168),
				"L-D: 06:00-22:00", "P", "D", "17/08/2026",
				java.time.Instant.now());
		when(stationRepository.findById("1")).thenReturn(java.util.Optional.of(station));
		when(currentPriceRepository.findByStation(station)).thenReturn(List.of());

		var detail = service.getStationDetail("1");

		assertThat(detail.precios()).isEmpty();
	}

	private org.locationtech.jts.geom.Point point(double lon, double lat) {
		org.locationtech.jts.geom.GeometryFactory factory =
				new org.locationtech.jts.geom.GeometryFactory(
						new org.locationtech.jts.geom.PrecisionModel(), 4326);
		return factory.createPoint(new org.locationtech.jts.geom.Coordinate(lon, lat));
	}

	private NearbyStationProjection projection(String id, String rotulo,
			double precio, double distanciaKm) {
		return new NearbyStationProjection() {
			@Override public String getOfficialId() { return id; }
			@Override public String getRotulo() { return rotulo; }
			@Override public String getDireccion() { return "DIR"; }
			@Override public String getLocalidad() { return "Madrid"; }
			@Override public String getProvincia() { return "Madrid"; }
			@Override public Double getLatitud() { return 40.4168; }
			@Override public Double getLongitud() { return -3.7038; }
			@Override public Double getDistanciaKm() { return distanciaKm; }
			@Override public BigDecimal getPrecio() { return BigDecimal.valueOf(precio); }
			@Override public String getDataDate() { return "17/08/2026"; }
		};
	}

	private NearbyStationProjection projectionWithoutPrice(String id, String rotulo,
			double distanciaKm) {
		return new NearbyStationProjection() {
			@Override public String getOfficialId() { return id; }
			@Override public String getRotulo() { return rotulo; }
			@Override public String getDireccion() { return "DIR"; }
			@Override public String getLocalidad() { return "Madrid"; }
			@Override public String getProvincia() { return "Madrid"; }
			@Override public Double getLatitud() { return 40.4168; }
			@Override public Double getLongitud() { return -3.7038; }
			@Override public Double getDistanciaKm() { return distanciaKm; }
			@Override public BigDecimal getPrecio() { return null; }
			@Override public String getDataDate() { return "17/08/2026"; }
		};
	}
}
