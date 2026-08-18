package com.example.gasolineras_api.mapper;

/**
 * Registro rechazado durante la normalización, con el identificador
 * de la estación y el motivo del rechazo.
 */
public record RejectedRecord(
		String stationId,
		String reason
) {}
