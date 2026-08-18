package com.example.gasolineras_api.repository;

import com.example.gasolineras_api.domain.PostalCode;
import com.example.gasolineras_api.domain.PostalCodeId;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PostalCodeRepository extends JpaRepository<PostalCode, PostalCodeId> {

	/**
	 * Asociaciones de un código postal (puede servir a varios municipios).
	 */
	List<PostalCode> findByIdCode(String code);
}