import React, { useEffect, useMemo, useState } from 'react';
import {
  BlockSegment,
  CanonicalProperty,
  GeocodeResult,
  PropertyCondition,
  PropertyTypology,
  SourceCategory,
  SourceRecord,
  UserTrackingStatus,
  ZoneDefinition,
  ZoneVariantId,
} from './types/domain';
import {
  buildGoogleStreetViewUrl,
  buildZonesForVariant,
  INITIAL_BLOCKS,
  INITIAL_PROPERTIES,
} from './data/caballitoFixtures';
import { CaballitoMap } from './components/CaballitoMap';

export const App: React.FC = () => {
  // Core domain state (backed by API + initialized with deterministic Caballito fixtures)
  const [activeVariant, setActiveVariant] =
    useState<ZoneVariantId>('ARANGUREN_COMPLETA');
  const [zones, setZones] = useState<ZoneDefinition[]>(() =>
    buildZonesForVariant('ARANGUREN_COMPLETA')
  );
  const [blocks, setBlocks] = useState<BlockSegment[]>(INITIAL_BLOCKS);
  const [allProperties, setAllProperties] =
    useState<CanonicalProperty[]>(INITIAL_PROPERTIES);

  // Selection & Side Panel tabs
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(
    'PROP-CAB-001'
  );
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(
    'BLK-ZA-GOY-0800'
  );
  const [activeTab, setActiveTab] = useState<'PROPERTY' | 'BLOCK' | 'LIST'>(
    'PROPERTY'
  );

  // 4 Persistent Main Filters (Especificación Funcional Sección 4)
  const [zoneFilter, setZoneFilter] = useState<string>('ALL');
  const [typologyFilter, setTypologyFilter] = useState<string>('ALL');
  const [maxUsdPerM2, setMaxUsdPerM2] = useState<string>('');
  const [conditionFilter, setConditionFilter] = useState<string>('ALL');
  const [onlyPriceDrops, setOnlyPriceDrops] = useState<boolean>(false);
  const [onlyDirectOwner, setOnlyDirectOwner] = useState<boolean>(false);
  const [onlyRealProperties, setOnlyRealProperties] = useState<boolean>(false);
  const [userStatusFilter, setUserStatusFilter] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<
    'opportunity_desc' | 'territorial_desc' | 'usd_m2_asc'
  >('opportunity_desc');

  // Geocoder / Address Search state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [geocodeResult, setGeocodeResult] = useState<GeocodeResult | null>(null);
  const [geocodeError, setGeocodeError] = useState<string | null>(null);
  const [focusTarget, setFocusTarget] = useState<{
    coordinates: [number, number];
    label: string;
  } | null>(null);

  // Tracking & Notes inputs
  const [newNoteText, setNewNoteText] = useState<string>('');
  const [discardInput, setDiscardInput] = useState<string>('');

  // Modals (Comparativa Proveedores Mapa, Validación Cartográfica USIG, Importador Real & Fuentes)
  const [activeModal, setActiveModal] = useState<
    'NONE' | 'MAP_COMPARISON' | 'GIS_AUDIT' | 'IMPORT_AND_SOURCES'
  >('NONE');

  // Real Listing Importer & Source Inspector state (IP-03 / IP-04 / IP-05 / IP-07)
  const [importAddress, setImportAddress] = useState<string>('');
  const [importRawText, setImportRawText] = useState<string>('');
  const [importPriceUsd, setImportPriceUsd] = useState<string>('');
  const [importAreaM2, setImportAreaM2] = useState<string>('');
  const [importRooms, setImportRooms] = useState<string>('3');
  const [importTypology, setImportTypology] =
    useState<PropertyTypology>('DEPTO_3AMB');
  const [importCondition, setImportCondition] =
    useState<PropertyCondition>('A_REFACCIONAR');
  const [importSourceCategory, setImportSourceCategory] =
    useState<SourceCategory>('DUENO_DIRECTO_FB_GRUPO');
  const [importSourceName, setImportSourceName] = useState<string>(
    'Dueño Directo / Captura Asistida'
  );
  const [importUrl, setImportUrl] = useState<string>('');
  const [importFeedback, setImportFeedback] = useState<string | null>(null);

  const [sources, setSources] = useState<SourceRecord[]>([]);
  const [newSourceUrl, setNewSourceUrl] = useState<string>('');
  const [newSourceName, setNewSourceName] = useState<string>('');

  // Sync initial data from backend API if running
  useEffect(() => {
    fetch('/api/zones')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.zones) {
          setZones(data.zones);
          setActiveVariant(data.activeVariant);
        }
      })
      .catch(() => {
        // Uses preloaded local fixtures seamlessly
      });

    fetch('/api/blocks')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.blocks) setBlocks(data.blocks);
      })
      .catch(() => {});

    fetch('/api/properties')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.properties) setAllProperties(data.properties);
      })
      .catch(() => {});

    fetch('/api/sources')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.sources) setSources(data.sources);
      })
      .catch(() => {});
  }, []);

  // Filtered and sorted eligible properties
  const filteredProperties = useMemo(() => {
    let list = [...allProperties];

    if (onlyRealProperties) {
      list = list.filter((p) => !p.isSynthetic);
    }
    if (zoneFilter !== 'ALL') {
      list = list.filter((p) => p.zoneId === zoneFilter);
    }
    if (typologyFilter !== 'ALL') {
      list = list.filter((p) => p.typology === typologyFilter);
    }
    if (maxUsdPerM2.trim() !== '') {
      const limit = Number(maxUsdPerM2);
      if (!Number.isNaN(limit) && limit > 0) {
        list = list.filter(
          (p) => p.usdPerM2Asking !== null && p.usdPerM2Asking <= limit
        );
      }
    }
    if (conditionFilter !== 'ALL') {
      list = list.filter((p) => p.conditionState === conditionFilter);
    }
    if (onlyPriceDrops) {
      list = list.filter((p) => p.hasRecentPriceDrop);
    }
    if (onlyDirectOwner) {
      list = list.filter((p) => p.isDirectOwnerDeclared);
    }
    if (userStatusFilter !== 'ALL') {
      list = list.filter((p) => p.userStatus === userStatusFilter);
    }

    if (sortBy === 'usd_m2_asc') {
      list.sort(
        (a, b) => (a.usdPerM2Asking ?? 999999) - (b.usdPerM2Asking ?? 999999)
      );
    } else if (sortBy === 'territorial_desc') {
      list.sort((a, b) => b.territorialScore - a.territorialScore);
    } else {
      list.sort((a, b) => b.opportunityScore - a.opportunityScore);
    }

    return list;
  }, [
    allProperties,
    zoneFilter,
    typologyFilter,
    maxUsdPerM2,
    conditionFilter,
    onlyPriceDrops,
    onlyDirectOwner,
    onlyRealProperties,
    userStatusFilter,
    sortBy,
  ]);

  const selectedProperty = useMemo(
    () =>
      allProperties.find((p) => p.id === selectedPropertyId) ??
      filteredProperties[0] ??
      allProperties[0],
    [allProperties, filteredProperties, selectedPropertyId]
  );

  const selectedBlock = useMemo(
    () =>
      blocks.find((b) => b.id === selectedBlockId) ??
      blocks.find((b) => b.id === selectedProperty?.blockId) ??
      blocks[0],
    [blocks, selectedBlockId, selectedProperty]
  );

  // Handlers
  const handleSelectBlock = (blockId: string) => {
    setSelectedBlockId(blockId);
    const propInBlock = allProperties.find((p) => p.blockId === blockId);
    if (propInBlock) {
      setSelectedPropertyId(propInBlock.id);
    } else {
      // Cuadra sin propiedades: muestra directamente la ficha territorial de la cuadra
      setActiveTab('BLOCK');
    }
  };

  const handleSelectProperty = (propertyId: string, blockId: string) => {
    setSelectedPropertyId(propertyId);
    setSelectedBlockId(blockId);
    setActiveTab('PROPERTY');
  };

  const handleChangeVariant = async (variant: ZoneVariantId) => {
    setActiveVariant(variant);
    const updated = buildZonesForVariant(variant);
    setZones(updated);
    try {
      await fetch('/api/zones/variant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variant, customOuterRing: null }),
      });
    } catch {
      // Local state already updated
    }
  };

  const handleApplyCustomNorthOffset = async (deltaLat: number) => {
    const currentZonaA = zones.find((z) => z.zoneType === 'ZONA_A');
    if (!currentZonaA) return;
    const adjustedRing: [number, number][] = currentZonaA.outerRing.map(
      ([lng, lat], idx) => {
        // Desplazar los dos vértices norte (índices 0 y 1 y cierre si coincide)
        if (idx === 0 || idx === 1 || idx === currentZonaA.outerRing.length - 1) {
          return [lng, Number((lat + deltaLat).toFixed(6))];
        }
        return [lng, lat];
      }
    );
    const updated = buildZonesForVariant(activeVariant, adjustedRing);
    setZones(updated);
    try {
      await fetch('/api/zones/variant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          variant: activeVariant,
          customOuterRing: adjustedRing,
        }),
      });
    } catch {}
  };

  const handleResetCustomGeometry = () => {
    handleChangeVariant(activeVariant);
  };

  const handleGeocodeSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeocodeError(null);
    const q = searchQuery.trim();
    if (!q) return;

    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data: GeocodeResult = await res.json();
        setGeocodeResult(data);
        setFocusTarget({
          coordinates: data.coordinates,
          label: data.matchedAddress,
        });
        return;
      }
    } catch {}

    // Local fallback search if offline
    const lower = q.toLowerCase();
    const matchedProp = allProperties.find((p) =>
      p.addressDisplay.toLowerCase().includes(lower)
    );
    if (matchedProp) {
      const fallback: GeocodeResult = {
        query: q,
        matchedAddress: matchedProp.addressDisplay,
        coordinates: matchedProp.coordinates,
        precision: matchedProp.locationPrecision,
        source: 'FIXTURE_LOCAL_CABALLITO',
        zoneId: matchedProp.zoneId,
        streetViewUrl: buildGoogleStreetViewUrl(
          matchedProp.coordinates,
          matchedProp.streetViewHeading
        ),
        streetViewAvailable: matchedProp.streetViewAvailable,
        warning:
          matchedProp.locationPrecision !== 'EXACTA'
            ? 'Ubicación aproximada a nivel cuadra (sin altura exacta en el aviso).'
            : undefined,
      };
      setGeocodeResult(fallback);
      setFocusTarget({
        coordinates: matchedProp.coordinates,
        label: matchedProp.addressDisplay,
      });
      handleSelectProperty(matchedProp.id, matchedProp.blockId);
      return;
    }

    const matchedBlk = blocks.find(
      (b) =>
        b.streetName.toLowerCase().includes(lower) ||
        `${b.streetName} ${b.heightRange}`.toLowerCase().includes(lower)
    );
    if (matchedBlk) {
      const fallback: GeocodeResult = {
        query: q,
        matchedAddress: `${matchedBlk.streetName} ${matchedBlk.heightRange} (${matchedBlk.fromStreet} – ${matchedBlk.toStreet})`,
        coordinates: matchedBlk.centerPoint,
        precision: 'APROXIMADA_CUADRA',
        source: 'FIXTURE_LOCAL_CABALLITO',
        zoneId: matchedBlk.zoneId,
        streetViewUrl: buildGoogleStreetViewUrl(
          matchedBlk.centerPoint,
          matchedBlk.streetViewHeading
        ),
        streetViewAvailable: matchedBlk.streetViewAvailable,
      };
      setGeocodeResult(fallback);
      setFocusTarget({
        coordinates: matchedBlk.centerPoint,
        label: fallback.matchedAddress,
      });
      handleSelectBlock(matchedBlk.id);
      return;
    }

    setGeocodeResult(null);
    setGeocodeError(
      'No se encontró la dirección en el padrón local POC-01. Probá con "Pedro Goyena 842", "Valle", "Puan 465", "Directorio 740", "Miró" o "Riglos 340".'
    );
  };

  const handleUpdateTrackingStatus = async (
    propertyId: string,
    newStatus: UserTrackingStatus,
    reason?: string,
    note?: string
  ) => {
    setAllProperties((prev) =>
      prev.map((p) => {
        if (p.id !== propertyId) return p;
        return {
          ...p,
          userStatus: newStatus,
          discardReason:
            typeof reason === 'string' ? reason : p.discardReason,
          userNotes:
            note && note.trim() !== ''
              ? [...p.userNotes, note.trim()]
              : p.userNotes,
        };
      })
    );

    try {
      await fetch(`/api/properties/${propertyId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userStatus: newStatus,
          discardReason: reason,
          note,
        }),
      });
    } catch {}
  };

  return (
    <div className="app-shell">
      {/* Non-negotiable Synthetic Data Notice Banner */}
      <div className="synthetic-banner">
        <div>
          ⚠️ <strong>MODO DEMOSTRACIÓN POC-01 (IP-00 + IP-01):</strong> Todos los
          inmuebles, precios e historiales son{' '}
          <u>DATOS SINTÉTICOS DE PRUEBA ETIQUETADOS</u>. Los polígonos y cruces de
          calles de Caballito / Parque Chacabuco están verificados contra USIG GCBA.
          ARV y MAO fuera del alcance del MVP.
        </div>
        <div className="synthetic-banner-badges">
          <span className="badge-pill" style={{ borderColor: '#10b981', color: '#6ee7b7' }}>
            ✓ PostGIS + USIG GCBA Conectados
          </span>
          <button
            className="btn"
            style={{ padding: '2px 8px', fontSize: '11px', background: onlyRealProperties ? '#059669' : '#1e293b' }}
            onClick={() => setOnlyRealProperties((v) => !v)}
          >
            {onlyRealProperties ? 'Mostrando Solo Datos Reales (Ver Demo)' : 'Ocultar Demo Sintética (Modo Real)'}
          </button>
        </div>
      </div>

      {/* Main Desktop Header */}
      <header className="top-header">
        <div className="brand-block">
          <div>
            <div className="brand-title">
              Flipping Search Intelligence · Caballito & Parque Chacabuco
            </div>
            <div className="brand-subtitle">
              Motor Territorial por Tramo/Vereda + Consolidación Multifuente N:1 ·
              Reglas Explicables v0.4
            </div>
          </div>
        </div>

        {/* Address / Block Geocoder Search */}
        <form className="search-box" onSubmit={handleGeocodeSearch}>
          <input
            type="text"
            placeholder="Buscar dirección o cuadra (ej: Pedro Goyena 842, Valle, Miró, Puan 465)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <button type="submit" className="btn btn-primary">
            Centrar Mapa
          </button>
        </form>

        {/* Action Buttons for POC-01 & Real MVP Importer */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            className="btn btn-primary"
            onClick={() => {
              setImportFeedback(null);
              setActiveModal('IMPORT_AND_SOURCES');
            }}
          >
            + Alta Real / Fuentes / Extra Zona
          </button>
          <button
            className="btn btn-emerald"
            onClick={() => setActiveModal('GIS_AUDIT')}
          >
            Auditoría GIS Zona A/B (USIG)
          </button>
          <button
            className="btn btn-amber"
            onClick={() => setActiveModal('MAP_COMPARISON')}
          >
            Comparativa MapLibre vs Google
          </button>
        </div>
      </header>

      {/* Geocoder Result / Error Feedback Bar */}
      {(geocodeResult || geocodeError) && (
        <div
          style={{
            background: geocodeError ? '#450a0a' : '#0f172a',
            borderBottom: '1px solid #334155',
            padding: '6px 16px',
            fontSize: '12px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          {geocodeError ? (
            <span style={{ color: '#fca5a5' }}>⚠️ {geocodeError}</span>
          ) : (
            geocodeResult && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span>
                  📍 <strong>{geocodeResult.matchedAddress}</strong> [
                  {geocodeResult.coordinates[1].toFixed(5)},{' '}
                  {geocodeResult.coordinates[0].toFixed(5)}]
                </span>
                <span
                  className={`tag ${
                    geocodeResult.precision === 'EXACTA'
                      ? 'tag-exact'
                      : 'tag-approx'
                  }`}
                >
                  Precisión: {geocodeResult.precision}
                </span>
                {geocodeResult.warning && (
                  <span style={{ color: '#fde047' }}>
                    ({geocodeResult.warning})
                  </span>
                )}
                {geocodeResult.streetViewAvailable ? (
                  <a
                    href={geocodeResult.streetViewUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-primary"
                    style={{ padding: '2px 8px', fontSize: '11px' }}
                  >
                    Abrir Google Street View ↗
                  </a>
                ) : (
                  <span className="tag tag-synthetic">
                    Street View sin cobertura confirmada en este tramo
                  </span>
                )}
              </div>
            )
          )}
          <button
            className="btn"
            style={{ padding: '2px 6px', fontSize: '11px' }}
            onClick={() => {
              setGeocodeResult(null);
              setGeocodeError(null);
            }}
          >
            Cerrar
          </button>
        </div>
      )}

      {/* 4 Persistent Main Filters Bar */}
      <section className="filters-bar">
        <div className="filter-group">
          <span className="filter-label">1. Zona:</span>
          <select
            className="filter-select"
            value={zoneFilter}
            onChange={(e) => setZoneFilter(e.target.value)}
          >
            <option value="ALL">Todas (Zona A + Zona B + Extra Zona)</option>
            <option value="zona-a">Solo Zona A Prioritaria</option>
            <option value="zona-b">Solo Zona B Secundaria</option>
            <option value="extra-zona">Solo Extra Zona</option>
          </select>
        </div>

        <div className="filter-group">
          <span className="filter-label">2. Tipología:</span>
          <select
            className="filter-select"
            value={typologyFilter}
            onChange={(e) => setTypologyFilter(e.target.value)}
          >
            <option value="ALL">Todas Elegibles (2/3 Amb, PH, Excep. 4 Amb)</option>
            <option value="DEPTO_2AMB">Depto 2 Ambientes</option>
            <option value="DEPTO_3AMB">Depto 3 Ambientes</option>
            <option value="PH">PH</option>
            <option value="DEPTO_4AMB_EXCEPCION">Depto 4 Amb (Excepción Reforma)</option>
          </select>
        </div>

        <div className="filter-group">
          <span className="filter-label">3. Tope USD/m²:</span>
          <input
            type="number"
            className="filter-input"
            style={{ width: '90px' }}
            placeholder="Ej: 1650"
            value={maxUsdPerM2}
            onChange={(e) => setMaxUsdPerM2(e.target.value)}
          />
        </div>

        <div className="filter-group">
          <span className="filter-label">4. Estado y Señales:</span>
          <select
            className="filter-select"
            value={conditionFilter}
            onChange={(e) => setConditionFilter(e.target.value)}
          >
            <option value="ALL">Cualquier estado</option>
            <option value="A_REFACCIONAR">A refaccionar íntegro</option>
            <option value="EPOCA_ORIGINAL">Época original</option>
            <option value="REGULAR">Regular / Cosmético</option>
          </select>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={onlyPriceDrops}
              onChange={(e) => setOnlyPriceDrops(e.target.checked)}
            />
            Con Rebaja
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={onlyDirectOwner}
              onChange={(e) => setOnlyDirectOwner(e.target.checked)}
            />
            Dueño Directo
          </label>
          <label className="checkbox-label" style={{ color: '#6ee7b7' }}>
            <input
              type="checkbox"
              checked={onlyRealProperties}
              onChange={(e) => setOnlyRealProperties(e.target.checked)}
            />
            Solo Reales
          </label>
        </div>

        <div className="filter-group">
          <span className="filter-label">Seguimiento:</span>
          <select
            className="filter-select"
            value={userStatusFilter}
            onChange={(e) => setUserStatusFilter(e.target.value)}
          >
            <option value="ALL">Todos ({allProperties.length})</option>
            <option value="ME_INTERESA">Me interesa</option>
            <option value="EN_OBSERVACION">En observación</option>
            <option value="SIN_CLASIFICAR">Sin clasificar</option>
            <option value="DESCARTAR">Descartadas</option>
          </select>
        </div>

        <div className="filter-group">
          <span className="filter-label">Ordenar:</span>
          <select
            className="filter-select"
            value={sortBy}
            onChange={(e) =>
              setSortBy(
                e.target.value as
                  | 'opportunity_desc'
                  | 'territorial_desc'
                  | 'usd_m2_asc'
              )
            }
          >
            <option value="opportunity_desc">Mayor Score Oportunidad</option>
            <option value="territorial_desc">Mayor Score Territorial Cuadra</option>
            <option value="usd_m2_asc">Menor USD/m² Pedido</option>
          </select>
        </div>
      </section>

      {/* Main Desktop Split: Map (Left) + Traceable Side Panel (Right) */}
      <main className="workspace-grid">
        <CaballitoMap
          zones={zones}
          activeVariant={activeVariant}
          blocks={blocks}
          properties={filteredProperties}
          selectedBlockId={selectedBlock?.id ?? null}
          selectedPropertyId={selectedProperty?.id ?? null}
          onSelectBlock={handleSelectBlock}
          onSelectProperty={handleSelectProperty}
          onChangeVariant={handleChangeVariant}
          onApplyCustomNorthOffset={handleApplyCustomNorthOffset}
          onResetCustomGeometry={handleResetCustomGeometry}
          focusTarget={focusTarget}
        />

        {/* Right Side Panel */}
        <aside className="side-panel">
          <div className="panel-tabs">
            <button
              className={`panel-tab ${activeTab === 'PROPERTY' ? 'active' : ''}`}
              onClick={() => setActiveTab('PROPERTY')}
            >
              Ficha de Inmueble ({filteredProperties.length})
            </button>
            <button
              className={`panel-tab ${activeTab === 'BLOCK' ? 'active' : ''}`}
              onClick={() => setActiveTab('BLOCK')}
            >
              Cuadra y Veredas ({blocks.length})
            </button>
            <button
              className={`panel-tab ${activeTab === 'LIST' ? 'active' : ''}`}
              onClick={() => setActiveTab('LIST')}
            >
              Ranking Elegibles
            </button>
          </div>

          <div className="panel-scroll">
            {/* TAB 1: CANONICAL PROPERTY DETAIL */}
            {activeTab === 'PROPERTY' && selectedProperty && (
              <>
                <div className="card">
                  <div className="card-header">
                    <div>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '6px' }}>
                        <span
                          className={`tag ${
                            selectedProperty.isSynthetic
                              ? 'tag-synthetic'
                              : 'tag-zona-a'
                          }`}
                        >
                          {selectedProperty.isSynthetic
                            ? 'DATO SINTÉTICO DE PRUEBA'
                            : '✓ DATO REAL INGRESADO POR USUARIO'}
                        </span>
                        <span
                          className={`tag ${
                            selectedProperty.zoneId === 'zona-a'
                              ? 'tag-zona-a'
                              : 'tag-zona-b'
                          }`}
                        >
                          {selectedProperty.zoneId === 'zona-a'
                            ? 'ZONA A PRIORITARIA'
                            : selectedProperty.zoneId === 'zona-b'
                            ? 'ZONA B SECUNDARIA'
                            : 'EXTRA ZONA BAJO DEMANDA'}
                        </span>
                        <span
                          className={`tag ${
                            selectedProperty.locationPrecision === 'EXACTA'
                              ? 'tag-exact'
                              : 'tag-approx'
                          }`}
                        >
                          Ubicación: {selectedProperty.locationPrecision}
                        </span>
                      </div>
                      <div className="card-title">
                        {selectedProperty.addressDisplay}
                      </div>
                      <div
                        style={{
                          fontSize: '11px',
                          color: '#94a3b8',
                          marginTop: '3px',
                        }}
                      >
                        ID Canónico: <code>{selectedProperty.id}</code> · Cuadra:{' '}
                        <code>{selectedProperty.blockId}</code>
                      </div>
                    </div>
                  </div>

                  {/* Location Precision & Street View Link */}
                  <div
                    style={{
                      background: 'rgba(15, 23, 42, 0.7)',
                      border: '1px solid #334155',
                      borderRadius: '6px',
                      padding: '8px 10px',
                      fontSize: '12px',
                      marginBottom: '10px',
                    }}
                  >
                    <div style={{ marginBottom: '6px', color: '#cbd5e1' }}>
                      📌 <strong>Trazabilidad Geográfica:</strong>{' '}
                      {selectedProperty.locationPrecisionNote}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      {selectedProperty.streetViewAvailable ? (
                        <a
                          href={buildGoogleStreetViewUrl(
                            selectedProperty.coordinates,
                            selectedProperty.streetViewHeading
                          )}
                          target="_blank"
                          rel="noreferrer"
                          className="btn btn-primary"
                        >
                          {selectedProperty.locationPrecision === 'EXACTA'
                            ? 'Abrir Google Street View (Fachada Exacta) ↗'
                            : 'Abrir Google Street View (Centroide de Cuadra) ↗'}
                        </a>
                      ) : (
                        <span className="tag tag-synthetic">
                          Street View no disponible en este punto
                        </span>
                      )}
                      <button
                        className="btn"
                        onClick={() => {
                          setSelectedBlockId(selectedProperty.blockId);
                          setActiveTab('BLOCK');
                        }}
                      >
                        Ver Cuadra y Veredas →
                      </button>
                    </div>
                  </div>

                  {/* Dual Scoring Grid: Opportunity vs Territorial */}
                  <div className="score-dual-grid">
                    <div className="score-box">
                      <div
                        style={{
                          fontSize: '10px',
                          color: '#94a3b8',
                          textTransform: 'uppercase',
                        }}
                      >
                        Señal Oportunidad Publicación
                      </div>
                      <div
                        className="score-number"
                        style={{ color: '#10b981' }}
                      >
                        {selectedProperty.opportunityScore}
                        <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                          /100
                        </span>
                      </div>
                      <div style={{ fontSize: '11px', color: '#cbd5e1', marginTop: '2px' }}>
                        Confianza: <strong>{selectedProperty.scoreConfidence}</strong> (
                        {selectedProperty.scoreVersion})
                      </div>
                    </div>

                    <div className="score-box">
                      <div
                        style={{
                          fontSize: '10px',
                          color: '#94a3b8',
                          textTransform: 'uppercase',
                        }}
                      >
                        Atractivo Territorial Cuadra
                      </div>
                      <div
                        className="score-number"
                        style={{ color: '#38bdf8' }}
                      >
                        {selectedProperty.territorialScore}
                        <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                          /100
                        </span>
                      </div>
                      <div style={{ fontSize: '11px', color: '#cbd5e1', marginTop: '2px' }}>
                        Descuento vs cuadra:{' '}
                        <strong style={{ color: '#6ee7b7' }}>
                          {selectedProperty.discountVsBlockPct !== null
                            ? `${selectedProperty.discountVsBlockPct}%`
                            : 'N/D'}
                        </strong>
                      </div>
                    </div>
                  </div>

                  {/* Key Property Attributes with explicit N/D handling */}
                  <div className="kv-grid">
                    <div className="kv-item">
                      <span className="kv-label">Tipología:</span>
                      <span className="kv-val">{selectedProperty.typology}</span>
                    </div>
                    <div className="kv-item">
                      <span className="kv-label">Ambientes:</span>
                      <span className="kv-val">{selectedProperty.rooms} amb</span>
                    </div>
                    <div className="kv-item">
                      <span className="kv-label">Precio Pedido:</span>
                      <span className="kv-val">
                        {selectedProperty.askingPriceUsdMin ===
                        selectedProperty.askingPriceUsdMax
                          ? `USD ${selectedProperty.askingPriceUsdMin.toLocaleString()}`
                          : `USD ${selectedProperty.askingPriceUsdMin.toLocaleString()} – ${selectedProperty.askingPriceUsdMax.toLocaleString()}`}
                      </span>
                    </div>
                    <div className="kv-item">
                      <span className="kv-label">USD/m² (Pedido):</span>
                      <span className="kv-val">
                        {selectedProperty.usdPerM2Asking
                          ? `USD ${selectedProperty.usdPerM2Asking}/m²`
                          : 'N/D'}
                      </span>
                    </div>
                    <div className="kv-item">
                      <span className="kv-label">Superficie Total / Cub.:</span>
                      <span className="kv-val">
                        {selectedProperty.totalAreaM2 ?? 'N/D'} m² /{' '}
                        {selectedProperty.coveredAreaM2 ?? 'N/D'} m²
                      </span>
                    </div>
                    <div className="kv-item">
                      <span className="kv-label">Estado Físico:</span>
                      <span className="kv-val">
                        {selectedProperty.conditionState}
                      </span>
                    </div>
                    <div className="kv-item">
                      <span className="kv-label">Vereda / Orientación:</span>
                      <span
                        className={`kv-val ${
                          selectedProperty.orientation === 'N/D'
                            ? 'nd-badge'
                            : ''
                        }`}
                      >
                        Vereda {selectedProperty.sidewalkSide} ·{' '}
                        {selectedProperty.orientation}
                      </span>
                    </div>
                    <div className="kv-item">
                      <span className="kv-label">Piso / Disposición:</span>
                      <span
                        className={`kv-val ${
                          selectedProperty.floorLabel === 'N/D'
                            ? 'nd-badge'
                            : ''
                        }`}
                      >
                        {selectedProperty.floorLabel}
                      </span>
                    </div>
                    <div className="kv-item">
                      <span className="kv-label">Expensas:</span>
                      <span
                        className={`kv-val ${
                          selectedProperty.expensesArs === null
                            ? 'nd-badge'
                            : ''
                        }`}
                      >
                        {selectedProperty.expensesArs === null
                          ? 'N/D (Sin dato)'
                          : selectedProperty.expensesArs === 0
                          ? 'Sin expensas ($0)'
                          : `ARS ${selectedProperty.expensesArs.toLocaleString()}`}
                      </span>
                    </div>
                    <div className="kv-item">
                      <span className="kv-label">Balcón:</span>
                      <span
                        className={`kv-val ${
                          selectedProperty.hasBalcony === null ? 'nd-badge' : ''
                        }`}
                      >
                        {selectedProperty.hasBalcony === null
                          ? 'N/D'
                          : selectedProperty.hasBalcony
                          ? 'Sí'
                          : 'No'}
                      </span>
                    </div>
                  </div>

                  {/* Missing Data Alert (if any) */}
                  {selectedProperty.missingDataFields.length > 0 && (
                    <div
                      style={{
                        marginTop: '10px',
                        padding: '8px',
                        background: 'rgba(234, 179, 8, 0.12)',
                        border: '1px solid rgba(234, 179, 8, 0.45)',
                        borderRadius: '6px',
                        fontSize: '11px',
                        color: '#fef08a',
                      }}
                    >
                      <strong>Datos Faltantes o No Confirmados (N/D):</strong>
                      <ul style={{ marginLeft: '16px', marginTop: '4px' }}>
                        {selectedProperty.missingDataFields.map((m, i) => (
                          <li key={i}>{m}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* User Tracking Status Actions (Me interesa / En observación / Descartar) */}
                  <div style={{ marginTop: '12px' }}>
                    <div
                      style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        color: '#94a3b8',
                        textTransform: 'uppercase',
                      }}
                    >
                      Decisión del Inversor (Estado actual:{' '}
                      <span style={{ color: '#38bdf8' }}>
                        {selectedProperty.userStatus}
                      </span>
                      )
                    </div>
                    <div className="status-actions">
                      <button
                        className={`btn ${
                          selectedProperty.userStatus === 'ME_INTERESA'
                            ? 'btn-emerald'
                            : ''
                        }`}
                        onClick={() =>
                          handleUpdateTrackingStatus(
                            selectedProperty.id,
                            'ME_INTERESA'
                          )
                        }
                      >
                        ★ Me interesa
                      </button>
                      <button
                        className={`btn ${
                          selectedProperty.userStatus === 'EN_OBSERVACION'
                            ? 'btn-amber'
                            : ''
                        }`}
                        onClick={() =>
                          handleUpdateTrackingStatus(
                            selectedProperty.id,
                            'EN_OBSERVACION'
                          )
                        }
                      >
                        👁 En observación
                      </button>
                      <button
                        className={`btn ${
                          selectedProperty.userStatus === 'DESCARTAR'
                            ? 'btn-danger'
                            : ''
                        }`}
                        onClick={() =>
                          handleUpdateTrackingStatus(
                            selectedProperty.id,
                            'DESCARTAR',
                            discardInput || 'Descartado en revisión POC-01'
                          )
                        }
                      >
                        ✕ Descartar
                      </button>
                    </div>

                    {/* Add note / discard reason */}
                    <div
                      style={{
                        display: 'flex',
                        gap: '6px',
                        marginTop: '8px',
                      }}
                    >
                      <input
                        type="text"
                        className="filter-input"
                        style={{ flex: 1 }}
                        placeholder="Agregar nota de campo o motivo de descarte..."
                        value={newNoteText}
                        onChange={(e) => setNewNoteText(e.target.value)}
                      />
                      <button
                        className="btn"
                        onClick={() => {
                          if (!newNoteText.trim()) return;
                          handleUpdateTrackingStatus(
                            selectedProperty.id,
                            selectedProperty.userStatus,
                            undefined,
                            newNoteText
                          );
                          setNewNoteText('');
                        }}
                      >
                        Guardar Nota
                      </button>
                    </div>

                    {selectedProperty.userNotes.length > 0 && (
                      <div
                        style={{
                          marginTop: '8px',
                          fontSize: '11px',
                          color: '#cbd5e1',
                        }}
                      >
                        <strong>Notas guardadas:</strong>
                        <ul style={{ marginLeft: '16px', marginTop: '3px' }}>
                          {selectedProperty.userNotes.map((n, idx) => (
                            <li key={idx}>{n}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>

                {/* Multi-Source Consolidation Card (1 Property : N Listings) */}
                <div className="card">
                  <div className="card-header">
                    <div className="card-title">
                      Publicaciones Vinculadas ({selectedProperty.listings.length}{' '}
                      fuentes)
                    </div>
                    {selectedProperty.isApparentlyExclusiveInObservedSources && (
                      <span className="tag tag-zona-b">
                        Aparentemente exclusivo entre fuentes observadas
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: '11px', color: '#94a3b8' }}>
                    Mantiene simultáneamente todos los avisos, precios y fechas de
                    observación. Una publicación ausente se marca{' '}
                    <code>NO_DETECTADA</code>, nunca como venta cerrada.
                  </p>

                  {selectedProperty.listings.map((lst) => (
                    <div key={lst.id} className="listing-item">
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: '4px',
                        }}
                      >
                        <strong>{lst.sourceName}</strong>
                        <span
                          className={`tag ${
                            lst.activeState === 'ACTIVA'
                              ? 'tag-zona-a'
                              : 'tag-synthetic'
                          }`}
                        >
                          {lst.activeState === 'ACTIVA'
                            ? 'ACTIVA'
                            : 'NO DETECTADA (≠ VENTA)'}
                        </span>
                      </div>
                      <div style={{ color: '#cbd5e1', marginBottom: '4px' }}>
                        Comercializa: <strong>{lst.agencyOrSeller}</strong> ·
                        Modo: <code>{lst.accessMode}</code>
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <span>
                          Precio pedido:{' '}
                          <strong style={{ color: '#f8fafc', fontSize: '13px' }}>
                            USD {lst.currentPriceUsd.toLocaleString()}
                          </strong>{' '}
                          {lst.priceDropPct !== null && lst.priceDropPct < 0 && (
                            <span style={{ color: '#6ee7b7' }}>
                              ({lst.priceDropPct}% vs USD{' '}
                              {lst.previousPriceUsd?.toLocaleString()})
                            </span>
                          )}
                        </span>
                        <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                          Últ. obs: {lst.lastObservedAt}
                        </span>
                      </div>
                      <div
                        style={{
                          marginTop: '6px',
                          paddingTop: '6px',
                          borderTop: '1px dashed rgba(148,163,184,0.2)',
                          fontSize: '11px',
                          color: '#94a3b8',
                        }}
                      >
                        <strong>Historial de Observaciones:</strong>
                        {lst.observations.map((obs) => (
                          <div key={obs.id}>
                            • {obs.observedAt}:{' '}
                            <strong>USD {obs.priceUsd.toLocaleString()}</strong> —{' '}
                            {obs.note}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Explainable Opportunity Score Breakdown */}
                <div className="card">
                  <div className="card-title" style={{ marginBottom: '6px' }}>
                    Explicación de Reglas — Score de Oportunidad (
                    {selectedProperty.opportunityScore}/100)
                  </div>
                  <p
                    style={{
                      fontSize: '11px',
                      color: '#94a3b8',
                      marginBottom: '8px',
                    }}
                  >
                    Reglas fijas y auditables (sin caja negra ni ML). No incluye
                    cálculo financiero ARV/MAO (fuera del MVP).
                  </p>
                  {selectedProperty.opportunityBreakdown.map((item, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: '6px 0',
                        borderBottom: '1px solid rgba(51,65,85,0.6)',
                        fontSize: '12px',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontWeight: 600,
                        }}
                      >
                        <span>
                          {item.criterion} (Peso {Math.round(item.weight * 100)}%)
                        </span>
                        <span style={{ color: '#6ee7b7' }}>
                          +{item.weightedPoints.toFixed(1)} pts
                        </span>
                      </div>
                      <div style={{ fontSize: '11px', color: '#cbd5e1' }}>
                        {item.explanation}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* TAB 2: STREET BLOCK & SIDEWALK DETAIL (Also works for empty blocks without properties) */}
            {activeTab === 'BLOCK' && selectedBlock && (
              <div className="card">
                <div className="card-header">
                  <div>
                    <div style={{ display: 'flex', gap: '6px', marginBottom: '6px' }}>
                      <span className="tag tag-synthetic">
                        TRAMO DE CUADRA SINTÉTICO
                      </span>
                      <span
                        className={`tag ${
                          selectedBlock.zoneId === 'zona-a'
                            ? 'tag-zona-a'
                            : 'tag-zona-b'
                        }`}
                      >
                        {selectedBlock.zoneId === 'zona-a' ? 'ZONA A' : 'ZONA B'}
                      </span>
                      {selectedBlock.activePropertyCount === 0 && (
                        <span className="tag tag-approx">
                          CUADRA SIN PUBLICACIONES ACTIVAS (SELECCIONABLE)
                        </span>
                      )}
                    </div>
                    <div className="card-title">
                      {selectedBlock.streetName} {selectedBlock.heightRange}
                    </div>
                    <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                      Entre <strong>{selectedBlock.fromStreet}</strong> y{' '}
                      <strong>{selectedBlock.toStreet}</strong> · ID:{' '}
                      <code>{selectedBlock.id}</code>
                    </div>
                  </div>
                </div>

                <div className="kv-grid" style={{ marginBottom: '10px' }}>
                  <div className="kv-item">
                    <span className="kv-label">Barrio Oficial:</span>
                    <span className="kv-val">{selectedBlock.neighborhood}</span>
                  </div>
                  <div className="kv-item">
                    <span className="kv-label">Microzona Inmobiliaria:</span>
                    <span className="kv-val">{selectedBlock.microzone}</span>
                  </div>
                  <div className="kv-item">
                    <span className="kv-label">Score Territorial:</span>
                    <span className="kv-val" style={{ color: '#38bdf8' }}>
                      {selectedBlock.territorialScore}/100 (Confianza:{' '}
                      {selectedBlock.scoreConfidence})
                    </span>
                  </div>
                  <div className="kv-item">
                    <span className="kv-label">Rango Ref. Pedido:</span>
                    <span
                      className={`kv-val ${
                        selectedBlock.usdM2RefMin === null ? 'nd-badge' : ''
                      }`}
                    >
                      {selectedBlock.usdM2RefMin !== null &&
                      selectedBlock.usdM2RefMax !== null
                        ? `USD ${selectedBlock.usdM2RefMin} – ${selectedBlock.usdM2RefMax}/m²`
                        : 'N/D (Muestra insuficiente)'}
                    </span>
                  </div>
                </div>

                {/* Both Sidewalks Detail (Vereda Par & Vereda Impar) */}
                <div
                  style={{
                    background: 'rgba(15, 23, 42, 0.7)',
                    border: '1px solid #334155',
                    borderRadius: '6px',
                    padding: '10px',
                    fontSize: '12px',
                    marginBottom: '10px',
                  }}
                >
                  <div style={{ fontWeight: 700, marginBottom: '6px', color: '#38bdf8' }}>
                    Análisis de Ambas Veredas (Orientación de Fachada ≠ Asoleamiento Real)
                  </div>
                  <div style={{ marginBottom: '6px' }}>
                    • <strong>Vereda PAR:</strong> Orientación{' '}
                    <code>{selectedBlock.sidewalks.even.orientation}</code> —{' '}
                    {selectedBlock.sidewalks.even.sunExposureNote} [
                    {selectedBlock.sidewalks.even.dataCompleteness}]
                  </div>
                  <div>
                    • <strong>Vereda IMPAR:</strong> Orientación{' '}
                    <code>{selectedBlock.sidewalks.odd.orientation}</code> —{' '}
                    {selectedBlock.sidewalks.odd.sunExposureNote} [
                    {selectedBlock.sidewalks.odd.dataCompleteness}]
                  </div>
                </div>

                {/* Transport & Street View for Block */}
                <div style={{ fontSize: '12px', marginBottom: '10px' }}>
                  🚇 <strong>Accesibilidad Peatonal en Red:</strong>{' '}
                  {selectedBlock.nearestTransport} (
                  {selectedBlock.subteWalkMins ?? 'N/D'} min a pie)
                </div>

                {selectedBlock.missingDataFields.length > 0 && (
                  <div
                    style={{
                      padding: '8px',
                      background: 'rgba(234, 179, 8, 0.12)',
                      border: '1px solid rgba(234, 179, 8, 0.45)',
                      borderRadius: '6px',
                      fontSize: '11px',
                      color: '#fef08a',
                      marginBottom: '10px',
                    }}
                  >
                    <strong>Datos Incompletos en Cuadra (N/D):</strong>
                    <ul style={{ marginLeft: '16px', marginTop: '4px' }}>
                      {selectedBlock.missingDataFields.map((f, i) => (
                        <li key={i}>{f}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                  {selectedBlock.streetViewAvailable ? (
                    <a
                      href={buildGoogleStreetViewUrl(
                        selectedBlock.centerPoint,
                        selectedBlock.streetViewHeading
                      )}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-primary"
                    >
                      Abrir Google Street View de la Cuadra ↗
                    </a>
                  ) : (
                    <span className="tag tag-synthetic">
                      Sin cobertura Street View confirmada en este tramo (Ver en
                      campo)
                    </span>
                  )}
                </div>

                <div className="card-title" style={{ marginBottom: '6px' }}>
                  Desglose de Score Territorial ({selectedBlock.territorialScore}/100)
                </div>
                {selectedBlock.scoreBreakdown.map((b, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: '6px 0',
                      borderBottom: '1px solid rgba(51,65,85,0.6)',
                      fontSize: '12px',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontWeight: 600,
                      }}
                    >
                      <span>
                        {b.criterion} ({Math.round(b.weight * 100)}%)
                      </span>
                      <span style={{ color: '#38bdf8' }}>
                        +{b.weightedPoints.toFixed(1)} pts
                      </span>
                    </div>
                    <div style={{ fontSize: '11px', color: '#cbd5e1' }}>
                      {b.explanation}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* TAB 3: FULL RANKED LIST OF ELIGIBLE CANDIDATES */}
            {activeTab === 'LIST' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                  Mostrando <strong>{filteredProperties.length}</strong> propiedades
                  elegibles (no se ocultan candidatos por puntaje bajo de forma
                  predeterminada).
                </div>
                {filteredProperties.map((p) => (
                  <div
                    key={p.id}
                    className="card"
                    style={{
                      cursor: 'pointer',
                      borderColor:
                        p.id === selectedProperty?.id ? '#38bdf8' : undefined,
                    }}
                    onClick={() => handleSelectProperty(p.id, p.blockId)}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '4px',
                      }}
                    >
                      <strong>{p.addressDisplay}</strong>
                      <span className="tag tag-zona-a">
                        Score: {p.opportunityScore}
                      </span>
                    </div>
                    <div style={{ fontSize: '12px', color: '#cbd5e1' }}>
                      {p.typology} · {p.totalAreaM2} m² ·{' '}
                      <strong>USD {p.askingPriceUsdMin.toLocaleString()}</strong> (
                      {p.usdPerM2Asking} USD/m²) · {p.conditionState}
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        gap: '6px',
                        marginTop: '6px',
                        flexWrap: 'wrap',
                      }}
                    >
                      <span className="tag tag-synthetic">SINTÉTICO</span>
                      <span className="tag tag-exact">
                        {p.listings.length} fuente(s)
                      </span>
                      {p.hasRecentPriceDrop && (
                        <span className="tag tag-zona-a">Rebaja detectada</span>
                      )}
                      {p.isDirectOwnerDeclared && (
                        <span className="tag tag-zona-b">
                          Dueño Directo Declarado
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>
      </main>

      {/* MODAL 1: COMPARATIVA MAPLIBRE/OSM VS GOOGLE MAPS (POC-01 Requirement #6) */}
      {activeModal === 'MAP_COMPARISON' && (
        <div className="modal-backdrop" onClick={() => setActiveModal('NONE')}>
          <div className="modal-window" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                Comparativa de Proveedor Cartográfico: MapLibre/OSM + USIG vs.
                Google Maps Platform (POC-01)
              </h3>
              <button className="btn" onClick={() => setActiveModal('NONE')}>
                Cerrar ✕
              </button>
            </div>
            <div className="modal-body">
              <p>
                Evaluación requerida por <code>05_POC_01_Mapa.md</code> antes de
                fijar proveedor definitivo para las fases siguientes:
              </p>
              <table className="comparison-table">
                <thead>
                  <tr>
                    <th>Criterio</th>
                    <th>MapLibre GL JS + OpenStreetMap + USIG CABA (Activo en POC)</th>
                    <th>Google Maps Platform (JS SDK + Geocoding + Street View)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <strong>Costo Mensual Operativo</strong>
                    </td>
                    <td>
                      <strong>USD 0 / mes</strong> (Sin tarjeta de crédito ni
                      bloqueos por cuota en desarrollo y operación local).
                    </td>
                    <td>
                      Crédito USD 200/mes; excedentes: Dynamic Maps USD 7/1k,
                      Geocoding USD 5/1k, Street View Dynamic USD 14/1k.
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <strong>Licencia de Persistencia en PostGIS</strong>
                    </td>
                    <td>
                      <strong>Permitida (ODbL / Datos Abiertos GCBA):</strong>{' '}
                      Permite guardar coordenadas, tramos de cuadra y polígonos
                      permanentemente en base propia PostGIS.
                    </td>
                    <td>
                      <strong>Restringida:</strong> Los ToS de Google prohíben
                      almacenar coordenadas de su Geocoder en una base propia
                      por más de 30 días o usarlas fuera de Google Maps.
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <strong>Street View (Fachadas)</strong>
                    </td>
                    <td>
                      Enlace directo oficial parametrizado por lat/lng y azimut (
                      <code>api=1&amp;map_action=pano</code>) sin consumir API Key.
                    </td>
                    <td>
                      Permite incrustar visor interactivo dentro del panel, pero
                      consume cuota de Dynamic Street View en cada clic.
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <strong>Orientación y Luz Solar en CABA</strong>
                    </td>
                    <td>
                      Cálculo geométrico de azimut por vereda par/impar en
                      PostGIS, advirtiendo que no equivale a asoleamiento real
                      de cada piso.
                    </td>
                    <td>
                      Google Solar API está diseñada para techos solares y NO
                      calcula luz vertical por piso/contrafrente en edificios de
                      Caballito.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: AUDITORÍA GIS USIG CABA (ZONA A & ZONA B) */}
      {activeModal === 'GIS_AUDIT' && (
        <div className="modal-backdrop" onClick={() => setActiveModal('NONE')}>
          <div className="modal-window" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                Auditoría Cartográfica USIG CABA — Límites de Zona A y Zona B
              </h3>
              <button className="btn" onClick={() => setActiveModal('NONE')}>
                Cerrar ✕
              </button>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: '10px' }}>
                Validación contra el callejero oficial de CABA (
                <code>servicios.usig.buenosaires.gob.ar</code>) de las
                discontinuidades de calles mencionadas en el Documento Maestro:
              </p>
              <ul style={{ marginLeft: '18px', marginBottom: '12px' }}>
                <li>
                  <strong>Emilio Mitre (Borde Este Zona A):</strong> Nace en Av.
                  Rivadavia hacia el sur. Para llegar hasta{' '}
                  <strong>Dr. Juan F. Aranguren</strong> cruzando el FFCC
                  Sarmiento, su continuación geográfica es{' '}
                  <strong>Federico García Lorca / Dr. Nicolás Repetto</strong>.
                </li>
                <li>
                  <strong>Malvinas Argentinas (Borde Oeste Zona A):</strong>{' '}
                  Nace en Av. Rivadavia hacia el sur. Su continuación al norte
                  de las vías hasta <strong>Dr. Juan F. Aranguren</strong> es{' '}
                  <strong>Nicasio Oroño</strong>.
                </li>
                <li>
                  <strong>Tte. Gral. Donato Álvarez (Borde Oeste Zona B):</strong>{' '}
                  Al cruzar Av. Rivadavia hacia el sur cambia su nombre a{' '}
                  <strong>Curapaligue</strong>.
                </li>
                <li>
                  <strong>Av. Acoyte (Borde Este Zona B):</strong> Al cruzar Av.
                  Rivadavia hacia el sur se denomina{' '}
                  <strong>Av. José María Moreno</strong>. Al norte empalma con
                  Av. Gaona mediante <strong>Av. Díaz Vélez</strong> (Cid
                  Campeador).
                </li>
                <li>
                  <strong>"Dos cuadras al sur de Av. Asamblea" (Borde Sur Zona B):</strong>{' '}
                  La 1ª paralela al sur es <strong>Santander</strong> y la 2ª
                  paralela continua entre J. M. Moreno y Curapaligue es{' '}
                  <strong>Saraza</strong>.
                </li>
              </ul>

              <table className="comparison-table">
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Intersección Verificada</th>
                    <th>Coordenadas (Lng, Lat)</th>
                    <th>Nota Cartográfica</th>
                  </tr>
                </thead>
                <tbody>
                  {zones
                    .flatMap((z) => z.verifiedVertices)
                    .map((v) => (
                      <tr key={v.code}>
                        <td>
                          <code>{v.code}</code>
                        </td>
                        <td>{v.intersection}</td>
                        <td>
                          <code>
                            [{v.coordinates[0]}, {v.coordinates[1]}]
                          </code>
                        </td>
                        <td>{v.note}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
      {/* MODAL 3: IMPORTADOR REAL DE AVISOS / DUEÑO DIRECTO / EXTRA ZONA & DIRECTORIO DE FUENTES (IP-03 / IP-04 / IP-05 / IP-07) */}
      {activeModal === 'IMPORT_AND_SOURCES' && (
        <div className="modal-backdrop" onClick={() => setActiveModal('NONE')}>
          <div className="modal-window" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                Alta Real Asistida (Dueño Directo / Portales / Extra Zona) +
                Directorio de Fuentes
              </h3>
              <button className="btn" onClick={() => setActiveModal('NONE')}>
                Cerrar ✕
              </button>
            </div>
            <div className="modal-body">
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1.15fr 0.85fr',
                  gap: '16px',
                }}
              >
                {/* Left Column: Import Real Property / Listing */}
                <div className="card">
                  <div className="card-title" style={{ marginBottom: '6px' }}>
                    1. Incorporar Publicación Real (Geocodificación USIG CABA + Deduplicación N:1)
                  </div>
                  <p style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '10px' }}>
                    Pegá el texto de un aviso (Facebook, Marketplace, Zonaprop,
                    inmobiliaria) o completá los datos. El sistema normaliza la
                    dirección con <strong>USIG GCBA en vivo</strong>, detecta si cae
                    en <strong>Zona A, Zona B o Extra Zona</strong> y verifica si ya
                    existe la unidad física para no duplicar fichas.
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div>
                      <label className="filter-label">
                        Dirección o Cuadra en CABA (Obligatorio):
                      </label>
                      <input
                        type="text"
                        className="filter-input"
                        style={{ width: '100%', marginTop: '3px' }}
                        placeholder="Ej: Av. Pedro Goyena 1150, Puan 465, o Valle al 700"
                        value={importAddress}
                        onChange={(e) => setImportAddress(e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="filter-label">
                        Pegar Texto del Anuncio (Extrae USD, m², amb y condición automáticamente):
                      </label>
                      <textarea
                        className="filter-input"
                        style={{ width: '100%', height: '66px', marginTop: '3px' }}
                        placeholder="Ej: Dueño directo vende 3 ambientes a refaccionar en Caballito, 68 m2, USD 105.000..."
                        value={importRawText}
                        onChange={(e) => setImportRawText(e.target.value)}
                      />
                    </div>

                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, 1fr)',
                        gap: '8px',
                      }}
                    >
                      <div>
                        <label className="filter-label">Precio USD:</label>
                        <input
                          type="number"
                          className="filter-input"
                          style={{ width: '100%', marginTop: '3px' }}
                          placeholder="Ej: 105000"
                          value={importPriceUsd}
                          onChange={(e) => setImportPriceUsd(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="filter-label">Superficie m²:</label>
                        <input
                          type="number"
                          className="filter-input"
                          style={{ width: '100%', marginTop: '3px' }}
                          placeholder="Ej: 68"
                          value={importAreaM2}
                          onChange={(e) => setImportAreaM2(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="filter-label">Ambientes:</label>
                        <select
                          className="filter-select"
                          style={{ width: '100%', marginTop: '3px' }}
                          value={importRooms}
                          onChange={(e) => setImportRooms(e.target.value)}
                        >
                          <option value="2">2 Ambientes</option>
                          <option value="3">3 Ambientes</option>
                          <option value="4">4 Amb (Excepción)</option>
                        </select>
                      </div>
                    </div>

                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, 1fr)',
                        gap: '8px',
                      }}
                    >
                      <div>
                        <label className="filter-label">Tipología:</label>
                        <select
                          className="filter-select"
                          style={{ width: '100%', marginTop: '3px' }}
                          value={importTypology}
                          onChange={(e) =>
                            setImportTypology(e.target.value as PropertyTypology)
                          }
                        >
                          <option value="DEPTO_2AMB">Depto 2 Amb</option>
                          <option value="DEPTO_3AMB">Depto 3 Amb</option>
                          <option value="PH">PH</option>
                          <option value="DEPTO_4AMB_EXCEPCION">Depto 4 Amb</option>
                        </select>
                      </div>
                      <div>
                        <label className="filter-label">Estado:</label>
                        <select
                          className="filter-select"
                          style={{ width: '100%', marginTop: '3px' }}
                          value={importCondition}
                          onChange={(e) =>
                            setImportCondition(e.target.value as PropertyCondition)
                          }
                        >
                          <option value="A_REFACCIONAR">A refaccionar</option>
                          <option value="EPOCA_ORIGINAL">Época original</option>
                          <option value="REGULAR">Regular</option>
                        </select>
                      </div>
                      <div>
                        <label className="filter-label">Categoría Origen:</label>
                        <select
                          className="filter-select"
                          style={{ width: '100%', marginTop: '3px' }}
                          value={importSourceCategory}
                          onChange={(e) =>
                            setImportSourceCategory(
                              e.target.value as SourceCategory
                            )
                          }
                        >
                          <option value="DUENO_DIRECTO_FB_GRUPO">
                            Dueño Directo — Grupo FB
                          </option>
                          <option value="DUENO_DIRECTO_MARKETPLACE">
                            Dueño Directo — Marketplace
                          </option>
                          <option value="INMOBILIARIA_INDEPENDIENTE">
                            Inmobiliaria Independiente
                          </option>
                          <option value="PORTAL_INMOBILIARIO">
                            Portal Inmobiliario
                          </option>
                          <option value="CARGA_MANUAL">
                            Carga en Campo / Extra Zona
                          </option>
                        </select>
                      </div>
                    </div>

                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: '8px',
                      }}
                    >
                      <div>
                        <label className="filter-label">Nombre Fuente / Agencia:</label>
                        <input
                          type="text"
                          className="filter-input"
                          style={{ width: '100%', marginTop: '3px' }}
                          value={importSourceName}
                          onChange={(e) => setImportSourceName(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="filter-label">URL del Aviso (Opcional · Auto-extrae datos):</label>
                        <div style={{ display: 'flex', gap: '4px', marginTop: '3px' }}>
                          <input
                            type="text"
                            className="filter-input"
                            style={{ flex: 1 }}
                            placeholder="https://..."
                            value={importUrl}
                            onChange={(e) => setImportUrl(e.target.value)}
                          />
                          <button
                            type="button"
                            className="btn btn-emerald"
                            onClick={async () => {
                              if (!importUrl.trim()) return;
                              setImportFeedback('Analizando URL pública...');
                              try {
                                const r = await fetch('/api/listings/extract-url', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ url: importUrl.trim() }),
                                });
                                const d = await r.json();
                                if (r.ok && d.draft) {
                                  if (d.draft.addressGuess && !importAddress) {
                                    setImportAddress(d.draft.addressGuess);
                                  }
                                  if (d.draft.priceUsd) {
                                    setImportPriceUsd(String(d.draft.priceUsd));
                                  }
                                  if (d.draft.totalAreaM2) {
                                    setImportAreaM2(String(d.draft.totalAreaM2));
                                  }
                                  if (d.draft.rooms) {
                                    setImportRooms(String(d.draft.rooms));
                                  }
                                  if (d.draft.typology) {
                                    setImportTypology(d.draft.typology);
                                  }
                                  if (d.draft.conditionState) {
                                    setImportCondition(d.draft.conditionState);
                                  }
                                  if (d.draft.sourceName) {
                                    setImportSourceName(d.draft.sourceName);
                                  }
                                  setImportRawText(
                                    `${d.draft.title || ''} - ${d.draft.description || ''}`.trim()
                                  );
                                  setImportFeedback(
                                    '✓ Metadatos extraídos de la URL. Revisá la dirección y hacé clic en Importar.'
                                  );
                                } else {
                                  setImportFeedback(
                                    d.error || 'No se pudieron extraer metadatos automáticos; completá el texto manualmente.'
                                  );
                                }
                              } catch {
                                setImportFeedback('Error al consultar la URL.');
                              }
                            }}
                          >
                            Extraer URL
                          </button>
                        </div>
                      </div>
                    </div>

                    <button
                      className="btn btn-primary"
                      style={{ justifyContent: 'center', padding: '8px' }}
                      onClick={async () => {
                        setImportFeedback(null);
                        try {
                          const res = await fetch('/api/listings/import', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              address: importAddress,
                              rawText: importRawText,
                              priceUsd: importPriceUsd
                                ? Number(importPriceUsd)
                                : undefined,
                              totalAreaM2: importAreaM2
                                ? Number(importAreaM2)
                                : undefined,
                              rooms: Number(importRooms),
                              typology: importTypology,
                              conditionState: importCondition,
                              sourceCategory: importSourceCategory,
                              sourceName: importSourceName,
                              externalUrl: importUrl,
                              isDirectOwnerDeclared:
                                importSourceCategory.startsWith('DUENO_DIRECTO'),
                            }),
                          });
                          const data = await res.json();
                          if (!res.ok) {
                            setImportFeedback(`Error: ${data.error}`);
                            return;
                          }
                          const savedProp: CanonicalProperty = data.property;
                          setAllProperties((prev) => {
                            const exists = prev.some((p) => p.id === savedProp.id);
                            return exists
                              ? prev.map((p) =>
                                  p.id === savedProp.id ? savedProp : p
                                )
                              : [savedProp, ...prev];
                          });
                          setSelectedPropertyId(savedProp.id);
                          setSelectedBlockId(savedProp.blockId);
                          setFocusTarget({
                            coordinates: savedProp.coordinates,
                            label: savedProp.addressDisplay,
                          });
                          setImportFeedback(
                            data.deduplicated
                              ? `✓ Deduplicación N:1 exitosa: se vinculó como nueva publicación de la propiedad existente (${savedProp.addressDisplay}).`
                              : `✓ Propiedad REAL creada y geocodificada con éxito en ${savedProp.zoneId.toUpperCase()} (${savedProp.addressDisplay}).`
                          );
                          setImportAddress('');
                          setImportRawText('');
                        } catch {
                          setImportFeedback(
                            'Error de red al importar la publicación.'
                          );
                        }
                      }}
                    >
                      Importar, Geocodificar en USIG CABA y Evaluar Duplicados
                    </button>

                    {importFeedback && (
                      <div
                        style={{
                          padding: '8px',
                          borderRadius: '6px',
                          background: 'rgba(16, 185, 129, 0.15)',
                          border: '1px solid #10b981',
                          color: '#6ee7b7',
                          fontSize: '12px',
                        }}
                      >
                        {importFeedback}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Column: Source Inspector & Directory (IP-03) */}
                <div className="card">
                  <div className="card-title" style={{ marginBottom: '6px' }}>
                    2. Directorio e Inspector de Fuentes por URL (IP-03)
                  </div>
                  <p style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '8px' }}>
                    Inspecciona <code>robots.txt</code> y sitemap público sin
                    sortear protecciones. Si la fuente es restringida (ej.
                    Facebook), queda en modo <code>ASISTIDO</code>.
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '10px' }}>
                    <input
                      type="text"
                      className="filter-input"
                      placeholder="Nombre (ej: Goyena Propiedades o Grupo FB)"
                      value={newSourceName}
                      onChange={(e) => setNewSourceName(e.target.value)}
                    />
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <input
                        type="text"
                        className="filter-input"
                        style={{ flex: 1 }}
                        placeholder="https://inmobiliaria-ejemplo.com.ar"
                        value={newSourceUrl}
                        onChange={(e) => setNewSourceUrl(e.target.value)}
                      />
                      <button
                        className="btn btn-emerald"
                        onClick={async () => {
                          if (!newSourceUrl.trim()) return;
                          const r = await fetch('/api/sources/inspect', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              url: newSourceUrl.trim(),
                              name: newSourceName.trim(),
                            }),
                          });
                          if (r.ok) {
                            const d = await r.json();
                            setSources((prev) => [d.source, ...prev]);
                            setNewSourceUrl('');
                            setNewSourceName('');
                          }
                        }}
                      >
                        Inspeccionar URL
                      </button>
                    </div>
                  </div>

                  <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
                    {sources.map((s) => (
                      <div key={s.id} className="listing-item">
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                        >
                          <strong>{s.name}</strong>
                          <span
                            className={`tag ${
                              s.accessMode === 'AUTOMATICO_AUTORIZADO'
                                ? 'tag-zona-a'
                                : 'tag-zona-b'
                            }`}
                          >
                            {s.accessMode}
                          </span>
                        </div>
                        <div style={{ fontSize: '11px', color: '#38bdf8' }}>
                          {s.baseUrl}
                        </div>
                        <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '3px' }}>
                          {s.notes}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
