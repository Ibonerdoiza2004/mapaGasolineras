package com.example.gasolineras_api.controller;

import com.example.gasolineras_api.domain.FuelType;
import com.example.gasolineras_api.dto.NearbyStationDto;
import com.example.gasolineras_api.dto.PriceRangeDto;
import com.example.gasolineras_api.dto.StationDetailDto;
import com.example.gasolineras_api.exception.InvalidParameterException;
import com.example.gasolineras_api.service.StationService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Endpoints de consulta de estaciones.
 */
@RestController
@RequestMapping("/api/stations")
public class StationController {

	private static final double RADIO_MAX_KM = 50.0;

	private static final int LIMIT_DEFAULT = 500;
	private static final int LIMIT_MAX = 500;

	private final StationService stationService;

	public StationController(StationService stationService) {
		this.stationService = stationService;
	}

	@GetMapping("/nearby")
	public List<NearbyStationDto> nearby(
			@RequestParam(value = "lat", required = false) Double lat,
			@RequestParam(value = "lon", required = false) Double lon,
			@RequestParam(value = "radio", required = false) Double radio,
			@RequestParam("combustible") FuelType combustible,
			@RequestParam(value = "orden", defaultValue = "precio") String orden,
			@RequestParam(value = "minLat", required = false) Double minLat,
			@RequestParam(value = "maxLat", required = false) Double maxLat,
			@RequestParam(value = "minLon", required = false) Double minLon,
			@RequestParam(value = "maxLon", required = false) Double maxLon,
			@RequestParam(value = "limit", required = false) Integer limit,
			@RequestParam(value = "offset", required = false) Integer offset,
			@RequestParam(value = "minPrecio", required = false) Double minPrecio,
			@RequestParam(value = "maxPrecio", required = false) Double maxPrecio
	) {
		QueryContext context = resolveQueryContext(lat, lon, radio, minLat, maxLat, minLon, maxLon);
		// El límite acota el viewport (sin él se devolverían miles de
		// estaciones al abrir el mapa). Con radio, sin límite se devuelven
		// todas las estaciones del rango, como pide el producto.
		Integer effectiveLimit = limit;
		if (effectiveLimit == null && radio == null) {
			effectiveLimit = LIMIT_DEFAULT;
		}
		if (effectiveLimit != null) {
			validateLimit(effectiveLimit);
		}
		if (offset != null && offset < 0) {
			throw new InvalidParameterException("offset", "El desplazamiento no puede ser negativo");
		}
		validatePriceRange(minPrecio, maxPrecio);
		StationService.OrderBy orderBy = parseOrder(orden);
		return stationService.findNearby(context.lat(), context.lon(), context.radioKm(),
				context.bounds(), combustible, orderBy, effectiveLimit, offset, minPrecio, maxPrecio);
	}

	/**
	 * Rango de precios (mínimo y máximo) sobre toda la base de datos, sin
	 * filtrar por combustible: acota el slider de precio y se mantiene estable
	 * aunque el usuario haga zoom, cambie de zona o de combustible.
	 */
	@GetMapping("/nearby/price-range")
	public PriceRangeDto priceRange() {
		return stationService.priceRangeOverall();
	}

	@GetMapping("/{id}")
	public StationDetailDto detail(@PathVariable("id") String id) {
		return stationService.getStationDetail(id);
	}

	private record QueryContext(double lat, double lon, Double radioKm, StationService.Bounds bounds) {
	}

	/** Valida y resuelve el área de consulta (radio o viewport) y la referencia. */
	private QueryContext resolveQueryContext(Double lat, Double lon, Double radio,
			Double minLat, Double maxLat, Double minLon, Double maxLon) {
		StationService.Bounds bounds = validateBounds(minLat, maxLat, minLon, maxLon);
		if (radio != null && bounds != null) {
			throw new InvalidParameterException(
					"bounds", "No se pueden combinar radio y viewport: usa uno de los dos");
		}
		if (bounds != null) {
			// Con viewport las coordenadas son opcionales: el rectángulo define
			// el área y el centro sirve de referencia si falta el punto.
			if (lat == null || lon == null) {
				lat = bounds.centerLat();
				lon = bounds.centerLon();
			} else {
				validateLatLon(lat, lon);
			}
		} else {
			validateLatLon(lat, lon);
		}
		validateRadio(radio);
		return new QueryContext(lat, lon, radio, bounds);
	}

	private void validatePriceRange(Double minPrecio, Double maxPrecio) {
		if (minPrecio != null && minPrecio < 0) {
			throw new InvalidParameterException("minPrecio", "El precio mínimo no puede ser negativo");
		}
		if (maxPrecio != null && maxPrecio < 0) {
			throw new InvalidParameterException("maxPrecio", "El precio máximo no puede ser negativo");
		}
		if (minPrecio != null && maxPrecio != null && minPrecio > maxPrecio) {
			throw new InvalidParameterException(
					"minPrecio", "El precio mínimo no puede superar al máximo");
		}
	}

	private void validateLatLon(Double lat, Double lon) {
		if (lat == null || lon == null) {
			throw new InvalidParameterException("lat", "La latitud y longitud son obligatorias");
		}
		if (lat < -90.0 || lat > 90.0) {
			throw new InvalidParameterException("lat", "La latitud debe estar entre -90 y 90");
		}
		if (lon < -180.0 || lon > 180.0) {
			throw new InvalidParameterException("lon", "La longitud debe estar entre -180 y 180");
		}
	}

	private void validateRadio(Double radio) {
		if (radio == null) {
			// Sin radio: el alcance lo decide el viewport (bounds) o todas.
			return;
		}
		if (radio <= 0.0) {
			throw new InvalidParameterException("radio", "El radio debe ser mayor que cero");
		}
		if (radio > RADIO_MAX_KM) {
			throw new InvalidParameterException("radio", "El radio máximo es " + RADIO_MAX_KM + " km");
		}
	}

	private void validateLimit(Integer limit) {
		if (limit < 1 || limit > LIMIT_MAX) {
			throw new InvalidParameterException(
					"limit", "El límite de resultados debe estar entre 1 y " + LIMIT_MAX);
		}
	}

	/**
	 * Valida los límites del rectángulo del viewport. Deben venir los cuatro
	 * juntos (o ninguno): latitud dentro de [-90, 90], longitud dentro de
	 * [-180, 180] y mínimos menores o iguales que los máximos.
	 */
	private StationService.Bounds validateBounds(Double minLat, Double maxLat,
			Double minLon, Double maxLon) {
		if (minLat == null && maxLat == null && minLon == null && maxLon == null) {
			return null;
		}
		if (minLat == null || maxLat == null || minLon == null || maxLon == null) {
			throw new InvalidParameterException(
					"bounds", "Los límites del viewport deben venir completos (minLat, maxLat, minLon, maxLon)");
		}
		if (minLat < -90.0 || maxLat > 90.0 || minLat > maxLat) {
			throw new InvalidParameterException("bounds", "Límites de latitud inválidos");
		}
		if (minLon < -180.0 || maxLon > 180.0 || minLon > maxLon) {
			throw new InvalidParameterException("bounds", "Límites de longitud inválidos");
		}
		return new StationService.Bounds(minLat, maxLat, minLon, maxLon);
	}

	private StationService.OrderBy parseOrder(String orden) {
		return switch (orden.toLowerCase()) {
			case "precio" -> StationService.OrderBy.PRECIO;
			case "distancia" -> StationService.OrderBy.DISTANCIA;
			case "ahorro" -> StationService.OrderBy.AHORRO;
			default -> throw new InvalidParameterException(
					"orden", "El orden debe ser precio, distancia o ahorro");
		};
	}
}
