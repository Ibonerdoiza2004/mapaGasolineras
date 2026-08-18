package com.example.gasolineras_api.domain;

import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

/**
 * Asociación código postal → municipio (callejero del censo electoral INE).
 * Un código postal puede corresponder a varios municipios.
 */
@Entity
@Table(name = "postal_codes")
public class PostalCode {

	@EmbeddedId
	private PostalCodeId id;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "municipalityCode", insertable = false, updatable = false)
	private Municipality municipality;

	protected PostalCode() {
	}

	public PostalCode(String code, Municipality municipality) {
		this.id = new PostalCodeId(code, municipality.getCode());
		this.municipality = municipality;
	}

	public PostalCodeId getId() {
		return id;
	}

	public Municipality getMunicipality() {
		return municipality;
	}
}