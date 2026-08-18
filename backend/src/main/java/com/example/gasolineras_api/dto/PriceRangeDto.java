package com.example.gasolineras_api.dto;

import java.math.BigDecimal;

/** Rango de precios (mínimo y máximo) de un combustible en un área. */
public record PriceRangeDto(BigDecimal min, BigDecimal max) {
}
