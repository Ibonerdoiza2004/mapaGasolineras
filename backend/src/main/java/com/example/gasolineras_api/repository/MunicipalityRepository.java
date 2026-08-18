package com.example.gasolineras_api.repository;

import com.example.gasolineras_api.domain.Municipality;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface MunicipalityRepository extends JpaRepository<Municipality, String> {

	/**
	 * Municipios cuyo nombre es similar al texto de la consulta (pg_trgm),
	 * priorizados por población. Tolerante a erratas y a acentos.
	 */
	@Query(value = """
			SELECT * FROM municipalities
			WHERE similarity(nombre, :query) >= :threshold
			ORDER BY poblacion DESC, similarity(nombre, :query) DESC
			LIMIT :limit
			""", nativeQuery = true)
	List<Municipality> findSimilar(@Param("query") String query, @Param("threshold") double threshold,
			@Param("limit") int limit);
}