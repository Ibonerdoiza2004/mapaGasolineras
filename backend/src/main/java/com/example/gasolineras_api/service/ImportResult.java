package com.example.gasolineras_api.service;

import java.time.Instant;

/**
 * Resultado de una ejecución de importación de datos del Geoportal.
 */
public record ImportResult(
		Instant timestamp,
		int stationsProcessed,
		int stationsValid,
		int stationsRejected,
		boolean success,
		String errorMessage
) {

	public static ImportResult success(Instant timestamp, int valid, int rejected) {
		return new ImportResult(timestamp, valid + rejected, valid, rejected, true, null);
	}

	public static ImportResult failure(Instant timestamp, String errorMessage) {
		return new ImportResult(timestamp, 0, 0, 0, false, errorMessage);
	}
}
