package com.example.gasolineras_api.client.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Estación de servicio tal y como la devuelve la API del Geoportal/MITECO.
 * Los valores se conservan como cadenas tal cual llegan del proveedor
 * (precios y coordenadas con coma decimal); la normalización se realiza en
 * una capa posterior.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record GeoportalStation(
		@JsonProperty("C.P.") String codigoPostal,
		@JsonProperty("Dirección") String direccion,
		@JsonProperty("Horario") String horario,
		@JsonProperty("Latitud") String latitud,
		@JsonProperty("Localidad") String localidad,
		@JsonProperty("Longitud (WGS84)") String longitud,
		@JsonProperty("Margen") String margen,
		@JsonProperty("Municipio") String municipio,
		@JsonProperty("Precio Gasoleo A") String precioGasoleoA,
		@JsonProperty("Precio Gasolina 95 E5") String precioGasolina95E5,
		@JsonProperty("Precio Gasolina 98 E5") String precioGasolina98E5,
		@JsonProperty("Provincia") String provincia,
		@JsonProperty("Remisión") String remision,
		@JsonProperty("Rótulo") String rotulo,
		@JsonProperty("Tipo Venta") String tipoVenta,
		@JsonProperty("% BioEtanol") String porcentajeBioetanol,
		@JsonProperty("% Éster metílico") String porcentajeEsterMetilico,
		@JsonProperty("IDEESS") String id,
		@JsonProperty("IDMunicipio") String idMunicipio,
		@JsonProperty("IDProvincia") String idProvincia,
		@JsonProperty("IDCCAA") String idComunidadAutonoma
) {}
