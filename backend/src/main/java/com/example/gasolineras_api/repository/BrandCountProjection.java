package com.example.gasolineras_api.repository;

/** Conteo de estaciones por marca (para el catálogo del filtro). */
public interface BrandCountProjection {

	String getMarca();

	long getCount();
}