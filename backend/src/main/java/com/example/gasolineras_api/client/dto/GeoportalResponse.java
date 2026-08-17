package com.example.gasolineras_api.client.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

/**
 * Respuesta de la API del Geoportal/MITECO al consultar estaciones terrestres.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record GeoportalResponse(
		@JsonProperty("Fecha") String fecha,
		@JsonProperty("Nota") String nota,
		@JsonProperty("ListaEESSPrecio") List<GeoportalStation> estaciones,
		@JsonProperty("ResultadoConsulta") String resultadoConsulta
) {}
