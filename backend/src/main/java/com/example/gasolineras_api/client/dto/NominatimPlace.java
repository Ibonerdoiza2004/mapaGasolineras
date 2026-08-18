package com.example.gasolineras_api.client.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Lugar devuelto por el servicio de geocodificación Nominatim (formato jsonv2).
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record NominatimPlace(
		@JsonProperty("place_id") long placeId,
		@JsonProperty("display_name") String displayName,
		@JsonProperty("type") String tipo,
		@JsonProperty("lat") String latitud,
		@JsonProperty("lon") String longitud
) {}