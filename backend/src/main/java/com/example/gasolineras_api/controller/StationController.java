package com.example.gasolineras_api.controller;

import com.example.gasolineras_api.domain.FuelType;
import com.example.gasolineras_api.dto.NearbyStationDto;
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

	private final StationService stationService;

	public StationController(StationService stationService) {
		this.stationService = stationService;
	}

	@GetMapping("/nearby")
	public List<NearbyStationDto> nearby(
			@RequestParam("lat") Double lat,
			@RequestParam("lon") Double lon,
			@RequestParam("radio") Double radio,
			@RequestParam("combustible") FuelType combustible,
			@RequestParam(value = "orden", defaultValue = "precio") String orden
	) {
		validateLatLon(lat, lon);
		validateRadio(radio);
		StationService.OrderBy orderBy = parseOrder(orden);
		return stationService.findNearby(lat, lon, radio, combustible, orderBy);
	}

	@GetMapping("/{id}")
	public StationDetailDto detail(@PathVariable("id") String id) {
		return stationService.getStationDetail(id);
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
			throw new InvalidParameterException("radio", "El radio es obligatorio");
		}
		if (radio <= 0.0) {
			throw new InvalidParameterException("radio", "El radio debe ser mayor que cero");
		}
		if (radio > RADIO_MAX_KM) {
			throw new InvalidParameterException("radio", "El radio máximo es " + RADIO_MAX_KM + " km");
		}
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
