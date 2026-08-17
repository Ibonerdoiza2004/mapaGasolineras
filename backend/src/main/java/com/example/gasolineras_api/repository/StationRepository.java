package com.example.gasolineras_api.repository;

import com.example.gasolineras_api.domain.Station;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface StationRepository extends JpaRepository<Station, String> {

	Optional<Station> findByOfficialId(String officialId);

	/**
	 * Devuelve estaciones dentro de un radio (en metros) junto con su distancia
	 * y el precio del combustible solicitado. El radio se mide sobre geografía
	 * (SRID 4326) para usar metros de forma correcta.
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
			""", nativeQuery = true)
	List<NearbyStationProjection> findNearby(
			@Param("lat") double lat,
			@Param("lon") double lon,
			@Param("radiusMeters") double radiusMeters,
			@Param("fuelType") String fuelType
	);
}
