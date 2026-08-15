FROM postgres:15-bookworm

RUN apt-get update \
    && apt-get install --yes --no-install-recommends \
        postgresql-15-postgis-3 \
        postgresql-15-postgis-3-scripts \
    && rm -rf /var/lib/apt/lists/*

COPY init-postgis.sql /docker-entrypoint-initdb.d/10-postgis.sql
