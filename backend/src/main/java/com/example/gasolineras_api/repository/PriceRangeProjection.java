package com.example.gasolineras_api.repository;

import java.math.BigDecimal;

/** Mínimo y máximo del precio de un combustible en un área. */
public interface PriceRangeProjection {
	BigDecimal getMinPrice();

	BigDecimal getMaxPrice();
}
