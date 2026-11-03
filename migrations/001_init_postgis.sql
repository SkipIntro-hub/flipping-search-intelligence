-- =============================================================================
-- Flipping Search Intelligence — Migración 001 (IP-00 / IP-01)
-- Esquema mínimo geoespacial PostGIS + Índices GiST + Trazabilidad y Procedencia
-- NOTA: Todos los registros semilla tienen is_synthetic = TRUE (Datos de prueba)
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS postgis;

-- 1. Zonas geográficas (Zona A prioritaria, Zona B secundaria, Extra Zona)
CREATE TABLE IF NOT EXISTS zones (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    zone_type VARCHAR(32) NOT NULL CHECK (zone_type IN ('ZONA_A', 'ZONA_B', 'EXTRA_ZONA')),
    priority INTEGER NOT NULL DEFAULT 1,
    validation_status VARCHAR(32) NOT NULL DEFAULT 'PENDIENTE_GIS'
        CHECK (validation_status IN ('VERIFICADA_GIS', 'PARCIAL_CON_OBSERVACIONES', 'PENDIENTE_GIS')),
    boundary_notes TEXT,
    geom GEOMETRY(Polygon, 4326) NOT NULL,
    is_synthetic BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_zones_geom ON zones USING GIST (geom);

-- 2. Tramos de cuadra (blocks / StreetSegment) con veredas diferenciadas
CREATE TABLE IF NOT EXISTS blocks (
    id VARCHAR(64) PRIMARY KEY,
    zone_id VARCHAR(64) NOT NULL REFERENCES zones(id),
    street_name VARCHAR(120) NOT NULL,
    from_street VARCHAR(120) NOT NULL,
    to_street VARCHAR(120) NOT NULL,
    height_range VARCHAR(64) NOT NULL,
    neighborhood VARCHAR(80) NOT NULL DEFAULT 'Caballito',
    microzone VARCHAR(120) NOT NULL,
    side VARCHAR(32) NOT NULL DEFAULT 'AMBAS'
        CHECK (side IN ('PAR', 'IMPAR', 'AMBAS')),
    even_side_orientation VARCHAR(32),
    odd_side_orientation VARCHAR(32),
    territorial_score NUMERIC(5,2),
    score_version VARCHAR(32) NOT NULL DEFAULT 'v0.4-poc',
    score_confidence VARCHAR(16) NOT NULL DEFAULT 'MEDIA'
        CHECK (score_confidence IN ('ALTA', 'MEDIA', 'BAJA', 'INCOMPLETA')),
    usd_m2_ref_min INTEGER,
    usd_m2_ref_max INTEGER,
    subte_walk_mins INTEGER,
    nearest_transport VARCHAR(120),
    geom GEOMETRY(LineString, 4326) NOT NULL,
    is_synthetic BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_blocks_geom ON blocks USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_blocks_zone ON blocks (zone_id);

-- 3. Fuentes de oferta inmobiliaria
CREATE TABLE IF NOT EXISTS sources (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    category VARCHAR(64) NOT NULL CHECK (category IN (
        'PORTAL_INMOBILIARIO',
        'INMOBILIARIA_INDEPENDIENTE',
        'DUENO_DIRECTO_SITIO',
        'DUENO_DIRECTO_FB_GRUPO',
        'DUENO_DIRECTO_MARKETPLACE',
        'CARGA_MANUAL'
    )),
    base_url TEXT,
    access_mode VARCHAR(32) NOT NULL CHECK (access_mode IN ('AUTOMATICO_AUTORIZADO', 'ASISTIDO', 'MANUAL', 'PENDIENTE')),
    policy_status VARCHAR(32) NOT NULL CHECK (policy_status IN ('APTA', 'PENDIENTE_REVISION', 'RESTRINGIDA', 'PAUSADA', 'ERROR')),
    last_checked_at TIMESTAMPTZ,
    is_synthetic BOOLEAN NOT NULL DEFAULT TRUE
);

-- 4. Propiedad física canónica (1 propiedad física : N publicaciones)
CREATE TABLE IF NOT EXISTS properties (
    id VARCHAR(64) PRIMARY KEY,
    block_id VARCHAR(64) REFERENCES blocks(id),
    zone_id VARCHAR(64) NOT NULL REFERENCES zones(id),
    address_display VARCHAR(200) NOT NULL,
    location_precision VARCHAR(32) NOT NULL CHECK (location_precision IN ('EXACTA', 'APROXIMADA_CUADRA', 'SIN_CONFIRMAR')),
    typology VARCHAR(32) NOT NULL CHECK (typology IN ('DEPTO_2AMB', 'DEPTO_3AMB', 'PH', 'DEPTO_4AMB_EXCEPCION')),
    rooms INTEGER NOT NULL,
    total_area_m2 NUMERIC(6,1),
    covered_area_m2 NUMERIC(6,1),
    condition_state VARCHAR(40) NOT NULL CHECK (condition_state IN ('A_REFACCIONAR', 'EPOCA_ORIGINAL', 'REGULAR', 'BUENO', 'ND')),
    orientation VARCHAR(32) DEFAULT 'N/D',
    floor_label VARCHAR(32) DEFAULT 'N/D',
    has_balcony BOOLEAN,
    expenses_ars INTEGER,
    is_direct_owner_declared BOOLEAN NOT NULL DEFAULT FALSE,
    opportunity_score NUMERIC(5,2),
    score_version VARCHAR(32) NOT NULL DEFAULT 'v0.4-poc',
    score_confidence VARCHAR(16) NOT NULL DEFAULT 'MEDIA',
    user_status VARCHAR(32) NOT NULL DEFAULT 'SIN_CLASIFICAR'
        CHECK (user_status IN ('SIN_CLASIFICAR', 'ME_INTERESA', 'EN_OBSERVACION', 'DESCARTAR')),
    discard_reason TEXT,
    geom GEOMETRY(Point, 4326) NOT NULL,
    is_synthetic BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_properties_geom ON properties USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_properties_block ON properties (block_id);

-- 5. Publicaciones detectadas o cargadas por fuente
CREATE TABLE IF NOT EXISTS listings (
    id VARCHAR(64) PRIMARY KEY,
    property_id VARCHAR(64) NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    source_id VARCHAR(64) NOT NULL REFERENCES sources(id),
    external_key VARCHAR(120),
    url TEXT NOT NULL,
    agency_or_seller VARCHAR(120) NOT NULL,
    current_price NUMERIC(12,2) NOT NULL,
    currency VARCHAR(8) NOT NULL DEFAULT 'USD',
    active_state VARCHAR(32) NOT NULL CHECK (active_state IN ('ACTIVA', 'NO_DETECTADA', 'RETIRADA', 'PAUSADA')),
    first_observed_at TIMESTAMPTZ NOT NULL,
    last_observed_at TIMESTAMPTZ NOT NULL,
    is_synthetic BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_listings_property ON listings (property_id);

-- 6. Observaciones históricas inmutables de precios y estados
CREATE TABLE IF NOT EXISTS observations (
    id VARCHAR(64) PRIMARY KEY,
    listing_id VARCHAR(64) NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
    observed_at TIMESTAMPTZ NOT NULL,
    price NUMERIC(12,2) NOT NULL,
    currency VARCHAR(8) NOT NULL DEFAULT 'USD',
    raw_ref TEXT,
    is_synthetic BOOLEAN NOT NULL DEFAULT TRUE
);

-- 7. Coincidencias de deduplicación (auditable y reversible)
CREATE TABLE IF NOT EXISTS matches (
    id VARCHAR(64) PRIMARY KEY,
    listing_a VARCHAR(64) NOT NULL REFERENCES listings(id),
    listing_b VARCHAR(64) NOT NULL REFERENCES listings(id),
    confidence NUMERIC(4,2) NOT NULL,
    decision VARCHAR(32) NOT NULL CHECK (decision IN ('VINCULADO', 'PENDIENTE_HUMANO', 'SEPARADO')),
    reason TEXT
);

-- 8. Notas de seguimiento del inversor
CREATE TABLE IF NOT EXISTS notes (
    id VARCHAR(64) PRIMARY KEY,
    property_id VARCHAR(64) NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. Eventos comerciales reproducibles (bajas de precio, reapariciones, altas)
CREATE TABLE IF NOT EXISTS events (
    id VARCHAR(64) PRIMARY KEY,
    listing_id VARCHAR(64) NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
    event_type VARCHAR(48) NOT NULL CHECK (event_type IN ('ALTA_INICIAL', 'BAJA_PRECIO', 'SUBA_PRECIO', 'REPUBLICACION', 'PUBLICACION_NO_DETECTADA')),
    occurred_at TIMESTAMPTZ NOT NULL,
    detail TEXT NOT NULL,
    is_synthetic BOOLEAN NOT NULL DEFAULT TRUE
);
