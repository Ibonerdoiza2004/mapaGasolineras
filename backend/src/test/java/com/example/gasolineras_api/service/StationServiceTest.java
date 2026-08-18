package com.example.gasolineras_api.service;

import com.example.gasolineras_api.domain.FuelType;
import com.example.gasolineras_api.dto.NearbyStationDto;
import com.example.gasolineras_api.exception.ResourceNotFoundException;
import com.example.gasolineras_api.mapper.BrandCatalog;
import com.example.gasolineras_api.repository.CurrentPriceRepository;
import com.example.gasolineras_api.repository.NearbyStationProjection;
import com.example.gasolineras_api.repository.PriceRangeProjection;
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
import static org.mockito.ArgumentMatchers.isNull;
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
		when(stationRepository.findNearby(eq(40.4168), eq(-3.7038), eq(10000.0),
				eq("GASOLINA_95"), eq("precio"), eq(200), isNull(), isNull(), isNull()))
				.thenReturn(List.of(
						projection("1", "REPSOL", 1.799, 5.0),
						projection("2", "CEPSA", 1.650, 8.0),
						projection("3", "BP", 1.700, 12.0)
				));
		when(stationRepository.findMinPriceNearby(eq(40.4168), eq(-3.7038),
				eq(10000.0), eq("GASOLINA_95"), isNull()))
				.thenReturn(new BigDecimal("1.650"));

		List<NearbyStationDto> result = service.findNearby(
				40.4168, -3.7038, 10.0, null, FuelType.GASOLINA_95, StationService.OrderBy.PRECIO, 200);

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
	@DisplayName("Empates de precio se desempatan de forma determinista por distancia")
	void priceTiesBreakDeterministically() {
		when(stationRepository.findNearby(eq(40.4168), eq(-3.7038), eq(10000.0),
				eq("GASOLINA_95"), eq("precio"), eq(200), isNull(), isNull(), isNull()))
				.thenReturn(List.of(
						projection("1", "REPSOL", 1.650, 9.0),
						projection("2", "CEPSA", 1.650, 3.0),
						projection("3", "BP", 1.700, 1.0)
				));
		when(stationRepository.findMinPriceNearby(eq(40.4168), eq(-3.7038),
				eq(10000.0), eq("GASOLINA_95"), isNull()))
				.thenReturn(new BigDecimal("1.650"));

		List<NearbyStationDto> result = service.findNearby(
				40.4168, -3.7038, 10.0, null, FuelType.GASOLINA_95,
				StationService.OrderBy.PRECIO, 200);

		// Mismo precio: el más cercano va primero; el orden es estable.
		assertThat(result).extracting("id").containsExactly("2", "1", "3");
	}

	@Test
	@DisplayName("Ordena por distancia cuando se solicita")
	void ordersByDistance() {
		when(stationRepository.findNearby(eq(40.4168), eq(-3.7038), eq(10000.0),
				eq("DIESEL"), eq("distancia"), eq(200), isNull(), isNull(), isNull()))
				.thenReturn(List.of(
						projection("1", "REPSOL", 1.799, 5.0),
						projection("2", "CEPSA", 1.650, 8.0),
						projection("3", "BP", 1.700, 1.0)
				));
		when(stationRepository.findMinPriceNearby(eq(40.4168), eq(-3.7038),
				eq(10000.0), eq("DIESEL"), isNull()))
				.thenReturn(new BigDecimal("1.650"));

		List<NearbyStationDto> result = service.findNearby(
				40.4168, -3.7038, 10.0, null, FuelType.DIESEL, StationService.OrderBy.DISTANCIA, 200);

		assertThat(result).hasSize(3);
		assertThat(result.get(0).id()).isEqualTo("3");
		assertThat(result.get(0).distanciaKm()).isEqualTo(1.0);
	}

	@Test
	@DisplayName("Ordena por ahorro cuando se solicita")
	void ordersBySavings() {
		when(stationRepository.findNearby(eq(40.4168), eq(-3.7038), eq(10000.0),
				eq("GASOLINA_98"), eq("precio"), eq(200), isNull(), isNull(), isNull()))
				.thenReturn(List.of(
						projection("1", "REPSOL", 1.799, 5.0),
						projection("2", "CEPSA", 1.650, 8.0),
						projection("3", "BP", 1.700, 1.0)
				));
		when(stationRepository.findMinPriceNearby(eq(40.4168), eq(-3.7038),
				eq(10000.0), eq("GASOLINA_98"), isNull()))
				.thenReturn(new BigDecimal("1.650"));

		List<NearbyStationDto> result = service.findNearby(
				40.4168, -3.7038, 10.0, null, FuelType.GASOLINA_98, StationService.OrderBy.AHORRO, 200);

		assertThat(result).hasSize(3);
		assertThat(result.get(0).id()).isEqualTo("2");
		assertThat(result.get(1).id()).isEqualTo("3");
		assertThat(result.get(2).id()).isEqualTo("1");
	}

	@Test
	@DisplayName("Una estación sin precio no se recomienda como mejor opción")
	void stationWithoutPriceHasNullSavings() {
		when(stationRepository.findNearby(eq(40.4168), eq(-3.7038), eq(10000.0),
				eq("GASOLINA_95"), eq("precio"), eq(200), isNull(), isNull(), isNull()))
				.thenReturn(List.of(
						projection("1", "REPSOL", 1.799, 5.0),
						projectionWithoutPrice("2", "CEPSA", 8.0)
				));
		when(stationRepository.findMinPriceNearby(eq(40.4168), eq(-3.7038),
				eq(10000.0), eq("GASOLINA_95"), isNull()))
				.thenReturn(new BigDecimal("1.799"));

		List<NearbyStationDto> result = service.findNearby(
				40.4168, -3.7038, 10.0, null, FuelType.GASOLINA_95, StationService.OrderBy.PRECIO, 200);

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
		when(stationRepository.findNearby(eq(40.4168), eq(-3.7038), eq(5000.0),
				eq("DIESEL"), eq("precio"), eq(200), isNull(), isNull(), isNull()))
				.thenReturn(List.of());

		service.findNearby(40.4168, -3.7038, 5.0, null, FuelType.DIESEL, StationService.OrderBy.PRECIO, 200);

		// Verifica que se llamó con 5000 metros
		org.mockito.Mockito.verify(stationRepository)
				.findNearby(40.4168, -3.7038, 5000.0, "DIESEL", "precio", 200, null, null, null);
	}

	@Test
	@DisplayName("Pasa el límite y el criterio de orden al repositorio")
	void forwardsLimitAndOrderModeToRepository() {
		when(stationRepository.findNearby(eq(40.4168), eq(-3.7038), eq(10000.0),
				eq("GASOLINA_95"), eq("precio"), eq(2), isNull(), isNull(), isNull()))
				.thenReturn(List.of());
		when(stationRepository.findMinPriceNearby(eq(40.4168), eq(-3.7038),
				eq(10000.0), eq("GASOLINA_95"), isNull()))
				.thenReturn(new BigDecimal("1.650"));

		service.findNearby(40.4168, -3.7038, 10.0, null, FuelType.GASOLINA_95,
				StationService.OrderBy.PRECIO, 2);

		org.mockito.Mockito.verify(stationRepository)
				.findNearby(40.4168, -3.7038, 10000.0, "GASOLINA_95", "precio", 2, null, null, null);
	}

	@Test
	@DisplayName("Sin límite pide todas las estaciones del rango al repositorio")
	void nullLimitRequestsFullRange() {
		when(stationRepository.findNearby(eq(40.4168), eq(-3.7038), eq(10000.0),
				eq("GASOLINA_95"), eq("precio"), eq(Integer.MAX_VALUE), isNull(), isNull(), isNull()))
				.thenReturn(List.of());
		when(stationRepository.findMinPriceNearby(eq(40.4168), eq(-3.7038),
				eq(10000.0), eq("GASOLINA_95"), isNull()))
				.thenReturn(new BigDecimal("1.599"));

		service.findNearby(40.4168, -3.7038, 10.0, null, FuelType.GASOLINA_95,
				StationService.OrderBy.PRECIO, null);

		org.mockito.Mockito.verify(stationRepository)
				.findNearby(40.4168, -3.7038, 10000.0, "GASOLINA_95", "precio", Integer.MAX_VALUE, null, null, null);
	}

	@Test
	@DisplayName("El ahorro usa el mínimo del rango completo aunque el resultado esté acotado")
	void savingsUseFullRangeMinEvenWithLimit() {
		// El repositorio acota en SQL (distancia, límite 1) y devuelve solo la
		// más cercana (BP); su ahorro se calcula frente al mínimo del rango
		// completo (CEPSA, que queda fuera del resultado).
		when(stationRepository.findNearby(eq(40.4168), eq(-3.7038), eq(10000.0),
				eq("DIESEL"), eq("distancia"), eq(1), isNull(), isNull(), isNull()))
				.thenReturn(List.of(projection("3", "BP", 1.700, 1.0)));
		when(stationRepository.findMinPriceNearby(eq(40.4168), eq(-3.7038),
				eq(10000.0), eq("DIESEL"), isNull()))
				.thenReturn(new BigDecimal("1.650"));

		List<NearbyStationDto> result = service.findNearby(
				40.4168, -3.7038, 10.0, null, FuelType.DIESEL,
				StationService.OrderBy.DISTANCIA, 1);

		assertThat(result).hasSize(1);
		assertThat(result.getFirst().id()).isEqualTo("3");
		assertThat(result.getFirst().ahorro()).isEqualByComparingTo(new BigDecimal("0.050"));
	}

	@Test
	@DisplayName("Sin radio consulta todas las estaciones")
	void nullRadiusQueriesAllStations() {
		when(stationRepository.findNearbyAll(eq(40.4168), eq(-3.7038),
				eq("GASOLINA_95"), eq("precio"), eq(200), isNull(), isNull(), isNull()))
				.thenReturn(List.of(
						projection("1", "REPSOL", 1.799, 350.0),
						projection("2", "CEPSA", 1.650, 420.0)
				));
		when(stationRepository.findMinPriceAll(eq("GASOLINA_95"), isNull()))
				.thenReturn(new BigDecimal("1.650"));

		List<NearbyStationDto> result = service.findNearby(
				40.4168, -3.7038, null, null, FuelType.GASOLINA_95, StationService.OrderBy.PRECIO, 200);

		assertThat(result).hasSize(2);
		assertThat(result.get(0).id()).isEqualTo("2");
		org.mockito.Mockito.verify(stationRepository)
				.findNearbyAll(40.4168, -3.7038, "GASOLINA_95", "precio", 200, null, null, null);
	}

	@Test
	@DisplayName("Sin radio pero con viewport consulta las estaciones del rectángulo")
	void boundsQueryStationsInViewport() {
		StationService.Bounds bounds = new StationService.Bounds(36.0, 44.0, -10.0, 3.0);
		when(stationRepository.findInBounds(eq(36.0), eq(44.0), eq(-10.0), eq(3.0),
				eq(40.0), eq(-3.5), eq("DIESEL"), eq("precio"), eq(200), eq(0), isNull(), isNull(), isNull()))
				.thenReturn(List.of(
						projection("1", "REPSOL", 1.799, 120.0)
				));
		when(stationRepository.findMinPriceInBounds(eq(36.0), eq(44.0), eq(-10.0), eq(3.0),
				eq("DIESEL"), isNull()))
				.thenReturn(new BigDecimal("1.799"));

		List<NearbyStationDto> result = service.findNearby(
				40.0, -3.5, null, bounds, FuelType.DIESEL, StationService.OrderBy.PRECIO, 200);

		assertThat(result).hasSize(1);
		assertThat(result.getFirst().id()).isEqualTo("1");
		org.mockito.Mockito.verify(stationRepository)
				.findInBounds(36.0, 44.0, -10.0, 3.0, 40.0, -3.5, "DIESEL", "precio", 200, 0, null, null, null);
	}

	@Test
	@DisplayName("El viewport con offset pide la siguiente página al repositorio")
	void boundsQueryForwardsOffset() {
		StationService.Bounds bounds = new StationService.Bounds(36.0, 44.0, -10.0, 3.0);
		when(stationRepository.findInBounds(eq(36.0), eq(44.0), eq(-10.0), eq(3.0),
				eq(40.0), eq(-3.5), eq("DIESEL"), eq("precio"), eq(200), eq(200), isNull(), isNull(), isNull()))
				.thenReturn(List.of(
						projection("2", "CEPSA", 1.805, 150.0)
				));
		when(stationRepository.findMinPriceInBounds(eq(36.0), eq(44.0), eq(-10.0), eq(3.0),
				eq("DIESEL"), isNull()))
				.thenReturn(new BigDecimal("1.799"));

		List<NearbyStationDto> result = service.findNearby(
				40.0, -3.5, null, bounds, FuelType.DIESEL, StationService.OrderBy.PRECIO,
				200, 200);

		assertThat(result).hasSize(1);
		assertThat(result.getFirst().id()).isEqualTo("2");
	}

	@Test
	@DisplayName("Un rango de precio se aplica en la consulta del viewport")
	void priceRangeFilterIsForwardedToRepository() {
		StationService.Bounds bounds = new StationService.Bounds(36.0, 44.0, -10.0, 3.0);
		when(stationRepository.findInBounds(eq(36.0), eq(44.0), eq(-10.0), eq(3.0),
				eq(40.0), eq(-3.5), eq("DIESEL"), eq("precio"), eq(200), eq(0),
				eq(1.4), eq(1.8), isNull()))
				.thenReturn(List.of(projection("1", "REPSOL", 1.5, 5.0)));
		when(stationRepository.findMinPriceInBounds(eq(36.0), eq(44.0), eq(-10.0), eq(3.0),
				eq("DIESEL"), isNull()))
				.thenReturn(new BigDecimal("1.4"));

		List<NearbyStationDto> result = service.findNearby(
				40.0, -3.5, null, bounds, FuelType.DIESEL, StationService.OrderBy.PRECIO,
				200, 0, 1.4, 1.8, List.of());

		assertThat(result).hasSize(1);
		org.mockito.Mockito.verify(stationRepository)
				.findInBounds(36.0, 44.0, -10.0, 3.0, 40.0, -3.5, "DIESEL", "precio", 200, 0, 1.4, 1.8, null);
	}

	@Test
	@DisplayName("El rango de precios del slider es el global de toda la base de datos")
	void priceRangeOverallIsGlobal() {
		when(stationRepository.findPriceRangeOverall())
				.thenReturn(new PriceRangeProjection() {
					@Override
					public java.math.BigDecimal getMinPrice() {
						return new java.math.BigDecimal("1.300");
					}

					@Override
					public java.math.BigDecimal getMaxPrice() {
						return new java.math.BigDecimal("2.299");
					}
				});

		var result = service.priceRangeOverall();

		assertThat(result.min()).isEqualByComparingTo(new java.math.BigDecimal("1.300"));
		assertThat(result.max()).isEqualByComparingTo(new java.math.BigDecimal("2.299"));
		org.mockito.Mockito.verify(stationRepository).findPriceRangeOverall();
	}

	@Test
	@DisplayName("El detalle de una estación existente devuelve todos los campos")
	void existingStationDetailReturnsAllFields() {
		var station = new com.example.gasolineras_api.domain.Station(
				"1", "REPSOL", "repsol", "CALLE MAYOR 1", "28001",
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
				"1", "REPSOL", "repsol", "DIR", "28001",
				"Madrid", "Madrid", "Madrid", point(-3.7038, 40.4168),
				"L-D: 06:00-22:00", "P", "D", "17/08/2026",
				java.time.Instant.now());
		when(stationRepository.findById("1")).thenReturn(java.util.Optional.of(station));
		when(currentPriceRepository.findByStation(station)).thenReturn(List.of());

		var detail = service.getStationDetail("1");

		assertThat(detail.precios()).isEmpty();
	}

	@Test
	@DisplayName("El catálogo de marcas se ordena por presencia (de mayor a menor) y «otras» al final")
	void listBrandsCombinesCatalogWithCounts() {
		when(stationRepository.countByBrand()).thenReturn(List.of(
				count("repsol", 42L),
				count("cepsa", 7L),
				count("moeve", 30L),
				count(BrandCatalog.OTHER, 91L)
		));

		var brands = service.listBrands();

		assertThat(brands).hasSize(BrandCatalog.catalog().size() + 1);
		// Las marcas con más estaciones primero y el resto con cero al final,
		// siempre antes de la marca de reserva "otras".
		assertThat(brands).extracting("code")
				.startsWith("repsol", "moeve", "cepsa");
		assertThat(brands.subList(0, brands.size() - 1)).extracting("code")
				.doesNotContain(BrandCatalog.OTHER);
		assertThat(brands.getFirst().label()).isEqualTo("Repsol");
		assertThat(brands.getFirst().count()).isEqualTo(42L);
		assertThat(brands.getLast().code()).isEqualTo(BrandCatalog.OTHER);
		assertThat(brands.getLast().label()).isEqualTo("Otras marcas");
		assertThat(brands.getLast().count()).isEqualTo(91L);
		// El resto de marcas (sin estaciones) conservan el orden del catálogo.
		var rest = brands.subList(3, brands.size() - 1);
		assertThat(rest).allSatisfy(b -> assertThat(b.count()).isZero());
		org.mockito.Mockito.verify(stationRepository).countByBrand();
	}

	@Test
	@DisplayName("Una marca sin estaciones aparece con conteo cero")
	void listBrandsReportsZeroForAbsentBrands() {
		when(stationRepository.countByBrand()).thenReturn(List.of());

		var brands = service.listBrands();

		assertThat(brands).hasSize(BrandCatalog.catalog().size() + 1);
		assertThat(brands).allSatisfy(b -> assertThat(b.count()).isZero());
	}

	@Test
	@DisplayName("El filtro de marcas se propaga al repositorio como lista separada por comas")
	void forwardsBrandFilterToRepository() {
		when(stationRepository.findNearby(eq(40.4168), eq(-3.7038), eq(10000.0),
				eq("GASOLINA_95"), eq("precio"), eq(200), isNull(), isNull(), eq("repsol,cepsa")))
				.thenReturn(List.of());
		when(stationRepository.findMinPriceNearby(eq(40.4168), eq(-3.7038),
				eq(10000.0), eq("GASOLINA_95"), isNull()))
				.thenReturn(new BigDecimal("1.650"));

		var result = service.findNearby(
				40.4168, -3.7038, 10.0, null, FuelType.GASOLINA_95, StationService.OrderBy.PRECIO,
				200, null, null, null, List.of("repsol", "cepsa"));

		assertThat(result).isEmpty();
		org.mockito.Mockito.verify(stationRepository)
				.findNearby(40.4168, -3.7038, 10000.0, "GASOLINA_95", "precio", 200, null, null, "repsol,cepsa");
	}

	private com.example.gasolineras_api.repository.BrandCountProjection count(String marca, long count) {
		return new com.example.gasolineras_api.repository.BrandCountProjection() {
			@Override public String getMarca() { return marca; }
			@Override public long getCount() { return count; }
		};
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
