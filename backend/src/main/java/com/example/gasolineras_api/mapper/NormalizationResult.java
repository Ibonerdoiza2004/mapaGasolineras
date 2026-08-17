package com.example.gasolineras_api.mapper;

import com.example.gasolineras_api.domain.NormalizedStation;

import java.util.List;

/**
 * Resultado de la normalización de un conjunto de estaciones.
 * Contiene las estaciones válidas y los registros rechazados con su motivo.
 */
public record NormalizationResult(
		String fechaActualizacion,
		List<NormalizedStation> validStations,
		List<RejectedRecord> rejectedRecords
) {}
