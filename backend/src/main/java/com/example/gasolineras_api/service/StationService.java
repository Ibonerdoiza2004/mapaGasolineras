package com.example.gasolineras_api.service;

import com.example.gasolineras_api.domain.CurrentPrice;
import com.example.gasolineras_api.domain.FuelType;
import com.example.gasolineras_api.domain.Station;
import com.example.gasolineras_api.dto.BrandDto;
import com.example.gasolineras_api.dto.NearbyStationDto;
import com.example.gasolineras_api.dto.PriceRangeDto;
import com.example.gasolineras_api.dto.StationDetailDto;
import com.example.gasolineras_api.exception.ResourceNotFoundException;
import com.example.gasolineras_api.mapper.BrandCatalog;
import com.example.gasolineras_api.repository.BrandCountProjection;
import com.example.gasolineras_api.repository.CurrentPriceRepository;
import com.example.gasolineras_api.repository.NearbyStationProjection;
import com.example.gasolineras_api.repository.PriceRangeProjection;
import com.example.gasolineras_api.repository.StationRepository;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;

/**
 * Servicio de consulta de estaciones.
 */
@Service
public class StationService {

	public enum OrderBy {
		PRECIO, DISTANCIA, AHORRO
	}

	/** Rectángulo geográfico del viewport del mapa. */
	public record Bounds(double minLat, double maxLat, double minLon, double maxLon) {
		public double centerLat() {
			return (minLat + maxLat) / 2.0;
		}

		public double centerLon() {
			return (minLon + maxLon) / 2.0;
		}
	}

	private final StationRepository stationRepository;
	private final CurrentPriceRepository currentPriceRepository;

	public StationService(StationRepository stationRepository,
			CurrentPriceRepository currentPriceRepository) {
		this.stationRepository = stationRepository;
		this.currentPriceRepository = currentPriceRepository;
	}

	/**
	 * Devuelve la ficha completa de una estación con sus precios disponibles.
	 *
	 * @param id identificador oficial de la estación
	 * @return ficha detallada
	 * @throws ResourceNotFoundException si la estación no existe
	 */
	public StationDetailDto getStationDetail(String id) {
		Station station = stationRepository.findById(id)
				.orElseThrow(() -> new ResourceNotFoundException("La estación " + id + " no existe"));

		Map<FuelType, BigDecimal> precios = new EnumMap<>(FuelType.class);
		for (CurrentPrice cp : currentPriceRepository.findByStation(station)) {
			precios.put(cp.getFuelType(), cp.getPrice());
		}

		return new StationDetailDto(
				station.getOfficialId(),
				station.getRotulo(),
				station.getDireccion(),
				station.getCodigoPostal(),
				station.getLocalidad(),
				station.getMunicipio(),
				station.getProvincia(),
				station.getLocation().getY(),
				station.getLocation().getX(),
				station.getHorario(),
				station.getTipoVenta(),
				station.getMargen(),
				precios,
				normalizeDataDate(station.getDataDate())
		);
	}

	/**
	 * Busca estaciones con el precio del combustible solicitado y calcula la
	 * distancia, el ahorro frente a la mejor opción y el orden solicitado.
	 * El alcance se decide así: con {@code radioKm} se filtran las estaciones
	 * dentro del radio; sin radio pero con {@code bounds} (viewport del mapa)
	 * se devuelven las estaciones visibles en ese rectángulo; sin ninguno se
	 * devuelven todas las estaciones.
	 *
	 * @param lat      latitud del centro de referencia
	 * @param lon      longitud del centro de referencia
	 * @param radioKm  radio de búsqueda en kilómetros; {@code null} sin radio
	 * @param bounds   rectángulo del viewport; {@code null} sin viewport
	 * @param fuelType combustible
	 * @param orderBy  criterio de ordenación
	 * @param limit    número máximo de resultados; {@code null} devuelve todas
	 *                 las estaciones del rango (el ahorro se calcula sobre
	 *                 todo el rango con una consulta agregada, no solo sobre
	 *                 los devueltos)
	 * @return lista de estaciones con distancia, precio y ahorro
	 */
	public List<NearbyStationDto> findNearby(double lat, double lon, Double radioKm,
			Bounds bounds, FuelType fuelType, OrderBy orderBy, Integer limit) {
		return findNearby(lat, lon, radioKm, bounds, fuelType, orderBy, limit, null, null, null, null);
	}

	/**
	 * Consulta estaciones cercanas. El offset permite paginar el viewport en
	 * páginas estables (desempate determinista en SQL); en modo radio, sin
	 * límite, no tiene efecto.
	 */
	public List<NearbyStationDto> findNearby(double lat, double lon, Double radioKm,
			Bounds bounds, FuelType fuelType, OrderBy orderBy, Integer limit, Integer offset) {
		return findNearby(lat, lon, radioKm, bounds, fuelType, orderBy, limit, offset, null, null, null);
	}

	/**
	 * Consulta estaciones cercanas, opcionalmente acotadas por rango de precio
	 * (minPrecio/maxPrecio en euros por litro, aplicados en SQL antes del
	 * límite, para que el tope de resultados no recorte antes de filtrar) y por
	 * marcas (códigos del catálogo, incluyendo "otras").
	 */
	public List<NearbyStationDto> findNearby(double lat, double lon, Double radioKm,
			Bounds bounds, FuelType fuelType, OrderBy orderBy, Integer limit, Integer offset,
			Double minPrecio, Double maxPrecio, List<String> marcas) {
		int resolvedLimit = limit != null ? limit : Integer.MAX_VALUE;
		int resolvedOffset = offset != null ? offset : 0;
		String orderMode = orderBy == OrderBy.DISTANCIA ? "distancia" : "precio";
		String marcasCsv = marcas == null || marcas.isEmpty() ? null : String.join(",", marcas);
		List<NearbyStationProjection> projections;
		BigDecimal bestPrice;
		if (radioKm != null) {
			double radiusMeters = radioKm * 1000.0;
			projections = stationRepository.findNearby(
					lat, lon, radiusMeters, fuelType.name(), orderMode, resolvedLimit,
					minPrecio, maxPrecio, marcasCsv);
			bestPrice = stationRepository.findMinPriceNearby(
					lat, lon, radiusMeters, fuelType.name(), marcasCsv);
		} else if (bounds != null) {
			projections = stationRepository.findInBounds(
					bounds.minLat(), bounds.maxLat(), bounds.minLon(), bounds.maxLon(),
					bounds.centerLat(), bounds.centerLon(), fuelType.name(), orderMode,
					resolvedLimit, resolvedOffset, minPrecio, maxPrecio, marcasCsv);
			bestPrice = stationRepository.findMinPriceInBounds(
					bounds.minLat(), bounds.maxLat(), bounds.minLon(), bounds.maxLon(),
					fuelType.name(), marcasCsv);
		} else {
			projections = stationRepository.findNearbyAll(
					lat, lon, fuelType.name(), orderMode, resolvedLimit, minPrecio, maxPrecio, marcasCsv);
			bestPrice = stationRepository.findMinPriceAll(fuelType.name(), marcasCsv);
		}

		return projections.stream()
				.map(p -> toDto(p, bestPrice))
				.sorted(comparator(orderBy))
				.toList();
	}

	/**
	 * Catálogo de marcas con el número de estaciones que las usan. Incluye las
	 * marcas conocidas (con su etiqueta) y, al final, la marca de reserva
	 * "otras" que agrupa los rótulos no reconocidos.
	 */
	public List<BrandDto> listBrands() {
		Map<String, Long> counts = stationRepository.countByBrand().stream()
				.collect(java.util.stream.Collectors.toMap(
						BrandCountProjection::getMarca,
						BrandCountProjection::getCount,
						Long::sum));
		// Las marcas más presentes primero (las más conocidas y fáciles de
		// localizar) y el resto después; "otras" siempre al final.
		List<BrandDto> brands = new java.util.ArrayList<>();
		BrandCatalog.catalog().stream()
				.sorted(java.util.Comparator
						.comparingLong((BrandCatalog.BrandEntry entry) ->
								counts.getOrDefault(entry.code(), 0L))
						.reversed())
				.forEach(entry ->
						brands.add(new BrandDto(entry.code(), entry.label(),
								counts.getOrDefault(entry.code(), 0L))));
		brands.add(new BrandDto(BrandCatalog.OTHER, "Otras marcas",
				counts.getOrDefault(BrandCatalog.OTHER, 0L)));
		return brands;
	}

	/**
	 * Rango de precios (mínimo y máximo) sobre toda la base de datos, sin
	 * filtrar por combustible: acota el slider de precio y se mantiene estable
	 * aunque el usuario cambie de combustible, zona o zoom.
	 */
	public PriceRangeDto priceRangeOverall() {
		PriceRangeProjection projection = stationRepository.findPriceRangeOverall();
		return new PriceRangeDto(projection == null ? null : projection.getMinPrice(),
				projection == null ? null : projection.getMaxPrice());
	}

	private NearbyStationDto toDto(NearbyStationProjection p, BigDecimal bestPrice) {
		BigDecimal ahorro = null;
		if (p.getPrecio() != null && bestPrice != null) {
			ahorro = p.getPrecio().subtract(bestPrice);
		}
		return new NearbyStationDto(
				p.getOfficialId(),
				p.getRotulo(),
				p.getDireccion(),
				p.getLocalidad(),
				p.getProvincia(),
				p.getLatitud(),
				p.getLongitud(),
				p.getDistanciaKm(),
				p.getPrecio(),
				ahorro,
				normalizeDataDate(p.getDataDate())
		);
	}

	/**
	 * Normaliza la fecha del MITECO (dd/MM/yyyy HH:mm:ss) a ISO 8601 local para
	 * que el frontend pueda mostrarla y calcular la frescura de forma fiable.
	 */
	private static String normalizeDataDate(String dataDate) {
		if (dataDate == null || dataDate.isBlank()) {
			return null;
		}
		String value = dataDate.trim();
		try {
			return LocalDateTime.parse(value, MITECO_DATETIME).toString();
		} catch (DateTimeParseException e) {
			// Se conserva el valor original si el formato no es el esperado.
			return value;
		}
	}

	private static final DateTimeFormatter MITECO_DATETIME =
			DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss");

	private Comparator<NearbyStationDto> comparator(OrderBy orderBy) {
		return switch (orderBy) {
			case DISTANCIA -> Comparator.comparingDouble(NearbyStationDto::distanciaKm)
					.thenComparingDouble(NearbyStationDto::latitud);
			case AHORRO -> Comparator
					.comparing(NearbyStationDto::ahorro, Comparator.nullsLast(Comparator.naturalOrder()))
					.thenComparing(NearbyStationDto::precio, Comparator.nullsLast(Comparator.naturalOrder()));
			case PRECIO -> Comparator
					.comparing(NearbyStationDto::precio, Comparator.nullsLast(Comparator.naturalOrder()))
					.thenComparingDouble(NearbyStationDto::distanciaKm);
		};
	}
}
