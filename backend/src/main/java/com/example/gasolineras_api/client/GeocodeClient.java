package com.example.gasolineras_api.client;

import com.example.gasolineras_api.client.dto.GeocodePlace;

import java.util.List;

/**
 * Cliente para consultar lugares por texto (geocodificación directa).
 */
public interface GeocodeClient {

	/**
	 * Busca lugares que coinciden con la consulta.
	 *
	 * @param query texto de búsqueda ya normalizado
	 * @return lista de lugares ordenada por relevancia, como máximo 8
	 * @throws GeocodeClientException si ocurre un error en la comunicación
	 */
	List<GeocodePlace> search(String query);

	/**
	 * Busca lugares por código postal (búsqueda estructurada del proveedor).
	 *
	 * @param postalCode código postal de 5 dígitos
	 * @return lista de lugares ordenada por relevancia, como máximo 8
	 * @throws GeocodeClientException si ocurre un error en la comunicación
	 */
	List<GeocodePlace> searchByPostalCode(String postalCode);
}