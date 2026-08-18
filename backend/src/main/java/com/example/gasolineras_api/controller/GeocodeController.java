package com.example.gasolineras_api.controller;

import com.example.gasolineras_api.dto.GeocodeSuggestionDto;
import com.example.gasolineras_api.exception.InvalidParameterException;
import com.example.gasolineras_api.service.GeocodeService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Endpoints de búsqueda de ubicaciones por texto.
 */
@RestController
@RequestMapping("/api/geocode")
public class GeocodeController {

	private static final int MIN_QUERY_LENGTH = 3;
	private static final int MAX_QUERY_LENGTH = 120;

	private final GeocodeService geocodeService;

	public GeocodeController(GeocodeService geocodeService) {
		this.geocodeService = geocodeService;
	}

	@GetMapping("/search")
	public List<GeocodeSuggestionDto> search(@RequestParam("q") String q) {
		validateQuery(q);
		return geocodeService.search(q);
	}

	private void validateQuery(String q) {
		String trimmed = q.trim();
		if (trimmed.length() < MIN_QUERY_LENGTH) {
			throw new InvalidParameterException(
					"q", "Escribe al menos " + MIN_QUERY_LENGTH + " caracteres para buscar");
		}
		if (trimmed.length() > MAX_QUERY_LENGTH) {
			throw new InvalidParameterException(
					"q", "La consulta no puede superar " + MAX_QUERY_LENGTH + " caracteres");
		}
	}
}