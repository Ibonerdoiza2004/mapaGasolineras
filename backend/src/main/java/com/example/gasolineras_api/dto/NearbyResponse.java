package com.example.gasolineras_api.dto;

import java.util.List;

/** Respuesta de cercanía: estaciones (ya filtradas/acotadas) y rango de
 *  precios del dataset completo del área, que acota el slider de precio. */
public record NearbyResponse(List<NearbyStationDto> stations, PriceRangeDto priceRange) {
}
