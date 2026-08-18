package com.example.gasolineras_api.dto;

/** Marca del catálogo con su etiqueta y el número de estaciones que la usan. */
public record BrandDto(String code, String label, long count) {
}