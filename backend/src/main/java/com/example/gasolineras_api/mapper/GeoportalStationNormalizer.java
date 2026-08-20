package com.example.gasolineras_api.mapper;

import com.example.gasolineras_api.client.dto.GeoportalStation;
import com.example.gasolineras_api.domain.FuelType;
import com.example.gasolineras_api.domain.NormalizedStation;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;

/**
 * Normaliza los datos crudos del Geoportal/MITECO a objetos de dominio.
 * Los registros con datos inválidos se rechazan sin abortar el resto.
 */
@Service
public class GeoportalStationNormalizer {

	private static final Logger log = LoggerFactory.getLogger(GeoportalStationNormalizer.class);

	private static final double LAT_MIN = -90.0;
	private static final double LAT_MAX = 90.0;
	private static final double LON_MIN = -180.0;
	private static final double LON_MAX = 180.0;

	// El Geoportal/MITECO solo publica estaciones en territorio español
	// (península, Canarias, Baleares, Ceuta y Melilla). Un rectángulo generoso
	// con margen descarta coordenadas corruptas del origen —como (0, 0) en el
	// golfo de Guinea o latitudes/longitudes intercambiadas que caerían en el
	// océano Índico— sin rechazar datos legítimos.
	private static final double SPAIN_LAT_MIN = 27.0;
	private static final double SPAIN_LAT_MAX = 44.5;
	private static final double SPAIN_LON_MIN = -18.5;
	private static final double SPAIN_LON_MAX = 5.0;

	private static boolean isWithinSpain(double lat, double lon) {
		return lat >= SPAIN_LAT_MIN && lat <= SPAIN_LAT_MAX
				&& lon >= SPAIN_LON_MIN && lon <= SPAIN_LON_MAX;
	}

	/**
	 * Normaliza una lista de estaciones crudas del Geoportal.
	 *
	 * @param rawStations          estaciones tal como llegan de la API
	 * @param fechaActualizacion   fecha de origen de los datos
	 * @return resultado con estaciones válidas y registros rechazados
	 */
	public NormalizationResult normalize(List<GeoportalStation> rawStations, String fechaActualizacion) {
		var validStations = new java.util.ArrayList<NormalizedStation>();
		var rejectedRecords = new java.util.ArrayList<RejectedRecord>();

		for (GeoportalStation raw : rawStations) {
			try {
				normalizeStation(raw).ifPresentOrElse(
						validStations::add,
						() -> {
							String id = raw.id() != null ? raw.id() : "desconocido";
							rejectedRecords.add(new RejectedRecord(id, "estación con datos inválidos"));
						}
				);
			} catch (Exception e) {
				String id = raw.id() != null ? raw.id() : "desconocido";
				log.warn("Error normalizando estación {}: {}", id, e.getMessage());
				rejectedRecords.add(new RejectedRecord(id, e.getMessage()));
			}
		}

		return new NormalizationResult(fechaActualizacion, validStations, rejectedRecords);
	}

	private java.util.Optional<NormalizedStation> normalizeStation(GeoportalStation raw) {
		if (raw.id() == null || raw.id().isBlank()) {
			log.warn("Estación sin ID, se descarta");
			return java.util.Optional.empty();
		}

		Double lat = parseCoordinate(raw.latitud(), "latitud", raw.id());
		if (lat == null) {
			return java.util.Optional.empty();
		}

		Double lon = parseCoordinate(raw.longitud(), "longitud", raw.id());
		if (lon == null) {
			return java.util.Optional.empty();
		}

		// El Geoportal a veces publica latitud y longitud intercambiadas. Como
		// los rangos de lat y lon son disjuntos (ver SPAIN_LAT_*/SPAIN_LON_*),
		// si (lat, lon) queda fuera pero (lon, lat) cae dentro es inequívoco
		// que estaban intercambiadas: se corrigen en vez de descartar.
		if (!isWithinSpain(lat, lon) && isWithinSpain(lon, lat)) {
			log.warn("Estación {}: latitud y longitud intercambiadas, se corrigen a ({}, {})",
					raw.id(), lon, lat);
			double correctedLat = lon;
			lon = lat;
			lat = correctedLat;
		}

		if (!isWithinSpain(lat, lon)) {
			log.warn("Estación {}: coordenadas ({}, {}) fuera del área de España, se descarta",
					raw.id(), lat, lon);
			return java.util.Optional.empty();
		}

		Map<FuelType, BigDecimal> precios = new EnumMap<>(FuelType.class);
		putPrice(precios, FuelType.DIESEL, raw.precioGasoleoA(), raw.id());
		putPrice(precios, FuelType.GASOLINA_95, raw.precioGasolina95E5(), raw.id());
		putPrice(precios, FuelType.GASOLINA_98, raw.precioGasolina98E5(), raw.id());

		return java.util.Optional.of(new NormalizedStation(
				raw.id(),
				raw.rotulo(),
				BrandCatalog.normalize(raw.rotulo()),
				raw.direccion(),
				raw.codigoPostal(),
				raw.localidad(),
				raw.municipio(),
				raw.provincia(),
				lat,
				lon,
				raw.horario(),
				raw.tipoVenta(),
				raw.margen(),
				precios
		));
	}

	private Double parseCoordinate(String raw, String field, String stationId) {
		if (raw == null || raw.isBlank()) {
			log.warn("Estación {}: {} vacía, se descarta", stationId, field);
			return null;
		}

		String normalized = raw.replace(',', '.');
		try {
			double value = Double.parseDouble(normalized);
			if (field.equals("latitud") && (value < LAT_MIN || value > LAT_MAX)) {
				log.warn("Estación {}: latitud {} fuera de rango, se descarta", stationId, value);
				return null;
			}
			if (field.equals("longitud") && (value < LON_MIN || value > LON_MAX)) {
				log.warn("Estación {}: longitud {} fuera de rango, se descarta", stationId, value);
				return null;
			}
			return value;
		} catch (NumberFormatException e) {
			log.warn("Estación {}: {} con formato inválido '{}', se descarta", stationId, field, raw);
			return null;
		}
	}

	private void putPrice(Map<FuelType, BigDecimal> precios, FuelType type, String raw, String stationId) {
		if (raw == null || raw.isBlank()) {
			return;
		}

		String normalized = raw.replace(',', '.');
		try {
			BigDecimal price = new BigDecimal(normalized);
			if (price.signum() < 0) {
				log.warn("Estación {}: precio {} negativo para {}, se ignora", stationId, price, type);
				return;
			}
			precios.put(type, price);
		} catch (NumberFormatException e) {
			log.warn("Estación {}: precio con formato inválido '{}' para {}, se ignora", stationId, raw, type);
		}
	}
}
