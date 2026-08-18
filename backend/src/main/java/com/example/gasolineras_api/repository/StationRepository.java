package com.example.gasolineras_api.repository;

import com.example.gasolineras_api.domain.Station;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

public interface StationRepository extends JpaRepository<Station, String> {

	Optional<Station> findByOfficialId(String officialId);

	/**
	 * Devuelve estaciones dentro de un radio (en metros) junto con su distancia
	 * y el precio del combustible solicitado. El radio se mide sobre geografía
	 * (SRID 4326) para usar metros de forma correcta. Los resultados se
	 * ordenan por el criterio indicado, se acotan al límite en SQL y pueden
	 * acotarse por rango de precio (minPrecio/maxPrecio, opcionales).
	 */
	@Query(value = """
			SELECT
				s.official_id AS officialId,
				s.rotulo AS rotulo,
				s.direccion AS direccion,
				s.localidad AS localidad,
				s.provincia AS provincia,
				ST_Y(s.location) AS latitud,
				ST_X(s.location) AS longitud,
				ST_Distance(s.location::geography,
					ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)::geography) / 1000.0 AS distanciaKm,
				cp.price AS precio,
				s.data_date AS dataDate
			FROM stations s
			LEFT JOIN current_prices cp
				ON cp.station_id = s.official_id AND cp.fuel_type = :fuelType
			WHERE ST_DWithin(
				s.location::geography,
				ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)::geography,
				:radiusMeters
			)
			AND (:marcas IS NULL OR COALESCE(s.marca, 'otras') = ANY(string_to_array(:marcas, ',')))
			AND (:minPrecio IS NULL OR cp.price >= :minPrecio)
			AND (:maxPrecio IS NULL OR cp.price <= :maxPrecio)
			ORDER BY
				CASE WHEN :orderMode = 'distancia'
					THEN ST_Distance(s.location::geography,
						ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)::geography)
					ELSE cp.price::double precision
				END ASC NULLS LAST
			LIMIT :limit
			""", nativeQuery = true)
	List<NearbyStationProjection> findNearby(
			@Param("lat") double lat,
			@Param("lon") double lon,
			@Param("radiusMeters") double radiusMeters,
			@Param("fuelType") String fuelType,
			@Param("orderMode") String orderMode,
			@Param("limit") int limit,
			@Param("minPrecio") Double minPrecio,
			@Param("maxPrecio") Double maxPrecio,
			@Param("marcas") String marcas
	);

	/**
	 * Devuelve todas las estaciones (sin filtro de radio) junto con su
	 * distancia al punto de referencia y el precio del combustible solicitado.
	 * Equivale a la opción "todas" del buscador. Ordenadas y acotadas en SQL;
	 * admiten un rango de precio opcional.
	 */
	@Query(value = """
			SELECT
				s.official_id AS officialId,
				s.rotulo AS rotulo,
				s.direccion AS direccion,
				s.localidad AS localidad,
				s.provincia AS provincia,
				ST_Y(s.location) AS latitud,
				ST_X(s.location) AS longitud,
				ST_Distance(s.location::geography,
					ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)::geography) / 1000.0 AS distanciaKm,
				cp.price AS precio,
				s.data_date AS dataDate
			FROM stations s
			LEFT JOIN current_prices cp
				ON cp.station_id = s.official_id AND cp.fuel_type = :fuelType
			WHERE (:marcas IS NULL OR s.marca = ANY(string_to_array(:marcas, ',')))
			AND (:minPrecio IS NULL OR cp.price >= :minPrecio)
			AND (:maxPrecio IS NULL OR cp.price <= :maxPrecio)
			ORDER BY
				CASE WHEN :orderMode = 'distancia'
					THEN ST_Distance(s.location::geography,
						ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)::geography)
					ELSE cp.price::double precision
				END ASC NULLS LAST
			LIMIT :limit
			""", nativeQuery = true)
	List<NearbyStationProjection> findNearbyAll(
			@Param("lat") double lat,
			@Param("lon") double lon,
			@Param("fuelType") String fuelType,
			@Param("orderMode") String orderMode,
			@Param("limit") int limit,
			@Param("minPrecio") Double minPrecio,
			@Param("maxPrecio") Double maxPrecio,
			@Param("marcas") String marcas
	);

	/**
	 * Devuelve las estaciones dentro de un rectángulo geográfico (el viewport
	 * del mapa) junto con su distancia al centro del rectángulo y el precio
	 * del combustible solicitado. Equivale a la opción "todas" cuando el mapa
	 * muestra un área concreta. Ordenadas y acotadas en SQL; el offset permite
	 * paginar de a páginas estables (el desempate por id hace determinista el
	 * orden entre páginas con precios o distancias empatados).
	 */
	@Query(value = """
			SELECT
				s.official_id AS officialId,
				s.rotulo AS rotulo,
				s.direccion AS direccion,
				s.localidad AS localidad,
				s.provincia AS provincia,
				ST_Y(s.location) AS latitud,
				ST_X(s.location) AS longitud,
				ST_Distance(s.location::geography,
					ST_SetSRID(ST_MakePoint(:centerLon, :centerLat), 4326)::geography) / 1000.0 AS distanciaKm,
				cp.price AS precio,
				s.data_date AS dataDate
			FROM stations s
			LEFT JOIN current_prices cp
				ON cp.station_id = s.official_id AND cp.fuel_type = :fuelType
			WHERE s.location IS NOT NULL
				AND ST_Y(s.location) BETWEEN :minLat AND :maxLat
				AND ST_X(s.location) BETWEEN :minLon AND :maxLon
				AND (:marcas IS NULL OR COALESCE(s.marca, 'otras') = ANY(string_to_array(:marcas, ',')))
				AND (:minPrecio IS NULL OR cp.price >= :minPrecio)
				AND (:maxPrecio IS NULL OR cp.price <= :maxPrecio)
			ORDER BY
				CASE WHEN :orderMode = 'distancia'
					THEN ST_Distance(s.location::geography,
						ST_SetSRID(ST_MakePoint(:centerLon, :centerLat), 4326)::geography)
					ELSE cp.price::double precision
				END ASC NULLS LAST,
				s.official_id ASC
			LIMIT :limit
			OFFSET :offset
			""", nativeQuery = true)
	List<NearbyStationProjection> findInBounds(
			@Param("minLat") double minLat,
			@Param("maxLat") double maxLat,
			@Param("minLon") double minLon,
			@Param("maxLon") double maxLon,
			@Param("centerLat") double centerLat,
			@Param("centerLon") double centerLon,
			@Param("fuelType") String fuelType,
			@Param("orderMode") String orderMode,
			@Param("limit") int limit,
			@Param("offset") int offset,
			@Param("minPrecio") Double minPrecio,
			@Param("maxPrecio") Double maxPrecio,
			@Param("marcas") String marcas
	);

	/** Precio mínimo del combustible en el radio (para calcular el ahorro). */
	@Query(value = """
			SELECT MIN(cp.price)
			FROM stations s
			JOIN current_prices cp
				ON cp.station_id = s.official_id AND cp.fuel_type = :fuelType
			WHERE ST_DWithin(
				s.location::geography,
				ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)::geography,
				:radiusMeters
			)
			AND (:marcas IS NULL OR COALESCE(s.marca, 'otras') = ANY(string_to_array(:marcas, ',')))
			""", nativeQuery = true)
	BigDecimal findMinPriceNearby(
			@Param("lat") double lat,
			@Param("lon") double lon,
			@Param("radiusMeters") double radiusMeters,
			@Param("fuelType") String fuelType,
			@Param("marcas") String marcas
	);

	/** Precio mínimo del combustible en todo el país (para calcular el ahorro). */
	@Query(value = """
			SELECT MIN(cp.price)
			FROM current_prices cp
			JOIN stations s ON s.official_id = cp.station_id
			WHERE cp.fuel_type = :fuelType
			AND (:marcas IS NULL OR COALESCE(s.marca, 'otras') = ANY(string_to_array(:marcas, ',')))
			""", nativeQuery = true)
	BigDecimal findMinPriceAll(
			@Param("fuelType") String fuelType,
			@Param("marcas") String marcas
	);

	/** Precio mínimo del combustible en el viewport (para calcular el ahorro). */
	@Query(value = """
			SELECT MIN(cp.price)
			FROM stations s
			JOIN current_prices cp
				ON cp.station_id = s.official_id AND cp.fuel_type = :fuelType
			WHERE s.location IS NOT NULL
				AND ST_Y(s.location) BETWEEN :minLat AND :maxLat
				AND ST_X(s.location) BETWEEN :minLon AND :maxLon
				AND (:marcas IS NULL OR COALESCE(s.marca, 'otras') = ANY(string_to_array(:marcas, ',')))
			""", nativeQuery = true)
	BigDecimal findMinPriceInBounds(
			@Param("minLat") double minLat,
			@Param("maxLat") double maxLat,
			@Param("minLon") double minLon,
			@Param("maxLon") double maxLon,
			@Param("fuelType") String fuelType,
			@Param("marcas") String marcas
	);

	/** Recuento de estaciones por marca (para el catálogo del filtro). Las
	 *  estaciones sin marca asignada (p. ej. importadas antes de esta columna)
	 *  se agrupan en "otras", de modo que la suma de los conteos equivale
	 *  siempre al total de estaciones. */
	@Query(value = """
			SELECT COALESCE(s.marca, 'otras') AS marca, COUNT(*) AS count
			FROM stations s
			GROUP BY COALESCE(s.marca, 'otras')
			""", nativeQuery = true)
	List<BrandCountProjection> countByBrand();

	/**
	 * Rango de precios (mínimo y máximo) sobre toda la base de datos, sin
	 * filtrar por combustible: acota el slider de precio y se mantiene estable
	 * aunque el usuario cambie de combustible, zona o zoom.
	 */
	@Query(value = """
			SELECT MIN(cp.price) AS minPrice, MAX(cp.price) AS maxPrice
			FROM current_prices cp
			""", nativeQuery = true)
	PriceRangeProjection findPriceRangeOverall();
}
