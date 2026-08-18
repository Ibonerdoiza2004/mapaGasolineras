package com.example.gasolineras_api.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;

import java.io.Serializable;
import java.util.Objects;

/**
 * Identificador compuesto de un código postal: el propio código y el
 * municipio al que pertenece (un código postal puede servir a varios
 * municipios).
 */
@Embeddable
public class PostalCodeId implements Serializable {

	@Column(length = 5)
	private String code;

	@Column(length = 5)
	private String municipalityCode;

	protected PostalCodeId() {
	}

	public PostalCodeId(String code, String municipalityCode) {
		this.code = code;
		this.municipalityCode = municipalityCode;
	}

	public String getCode() {
		return code;
	}

	public String getMunicipalityCode() {
		return municipalityCode;
	}

	@Override
	public boolean equals(Object other) {
		if (this == other) {
			return true;
		}
		if (!(other instanceof PostalCodeId that)) {
			return false;
		}
		return Objects.equals(code, that.code) && Objects.equals(municipalityCode, that.municipalityCode);
	}

	@Override
	public int hashCode() {
		return Objects.hash(code, municipalityCode);
	}
}