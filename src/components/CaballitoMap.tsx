import React, { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import {
  BlockSegment,
  CanonicalProperty,
  ZoneDefinition,
  ZoneVariantId,
} from '../types/domain';
import { buildGoogleStreetViewUrl } from '../data/caballitoFixtures';

interface CaballitoMapProps {
  zones: ZoneDefinition[];
  activeVariant: ZoneVariantId;
  blocks: BlockSegment[];
  properties: CanonicalProperty[];
  selectedBlockId: string | null;
  selectedPropertyId: string | null;
  onSelectBlock: (blockId: string) => void;
  onSelectProperty: (propertyId: string, blockId: string) => void;
  onChangeVariant: (variant: ZoneVariantId) => void;
  onApplyCustomNorthOffset: (deltaLat: number) => void;
  onResetCustomGeometry: () => void;
  focusTarget: { coordinates: [number, number]; label: string } | null;
}

const SUBTE_STATIONS_GEOJSON: GeoJSON.FeatureCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { label: 'Subte A · Río de Janeiro' },
      geometry: { type: 'Point', coordinates: [-58.4295, -34.6152] },
    },
    {
      type: 'Feature',
      properties: { label: 'Subte A · Acoyte' },
      geometry: { type: 'Point', coordinates: [-58.43646, -34.6183] },
    },
    {
      type: 'Feature',
      properties: { label: 'Subte A · Primera Junta' },
      geometry: { type: 'Point', coordinates: [-58.4412, -34.6204] },
    },
    {
      type: 'Feature',
      properties: { label: 'Subte A · Puan' },
      geometry: { type: 'Point', coordinates: [-58.4484, -34.6235] },
    },
    {
      type: 'Feature',
      properties: { label: 'Subte A · Carabobo' },
      geometry: { type: 'Point', coordinates: [-58.4567, -34.6266] },
    },
    {
      type: 'Feature',
      properties: { label: 'Subte E · J. M. Moreno' },
      geometry: { type: 'Point', coordinates: [-58.4338, -34.628] },
    },
    {
      type: 'Feature',
      properties: { label: 'Subte E · Emilio Mitre' },
      geometry: { type: 'Point', coordinates: [-58.4426, -34.631] },
    },
    {
      type: 'Feature',
      properties: { label: 'Subte E · Medalla Milagrosa' },
      geometry: { type: 'Point', coordinates: [-58.4503, -34.6363] },
    },
    {
      type: 'Feature',
      properties: { label: 'FFCC Sarmiento · Est. Caballito' },
      geometry: { type: 'Point', coordinates: [-58.4428, -34.6189] },
    },
  ],
};

type BasemapMode = 'STREET' | 'SATELLITE' | 'TOPO';

const BASEMAP_TILES: Record<BasemapMode, string> = {
  STREET:
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
  SATELLITE:
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  TOPO:
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
};

export const CaballitoMap: React.FC<CaballitoMapProps> = ({
  zones,
  activeVariant,
  blocks,
  properties,
  selectedBlockId,
  selectedPropertyId,
  onSelectBlock,
  onSelectProperty,
  onChangeVariant,
  onApplyCustomNorthOffset,
  onResetCustomGeometry,
  focusTarget,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [mapReady, setMapReady] = useState(false);

  // Layer visibility toggles
  const [basemap, setBasemap] = useState<BasemapMode>('STREET');
  const [showZonaA, setShowZonaA] = useState(true);
  const [showZonaB, setShowZonaB] = useState(true);
  const [showBlocks, setShowBlocks] = useState(true);
  const [showProperties, setShowProperties] = useState(true);
  const [showSubte, setShowSubte] = useState(true);
  const [showUsigNodes, setShowUsigNodes] = useState(true);
  const [blockColorMode, setBlockColorMode] = useState<'SCORE' | 'USD_M2'>('SCORE');
  const [editGeometryOpen, setEditGeometryOpen] = useState(false);

  // Initialize MapLibre GL JS with watermark-free Esri Street / Satellite tiles
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    try {
      const map = new maplibregl.Map({
        container: mapContainerRef.current,
        style: {
          version: 8,
          sources: {
            'basemap-street': {
              type: 'raster',
              tiles: [BASEMAP_TILES.STREET],
              tileSize: 256,
              attribution:
                '© Esri · OpenStreetMap · Callejero Oficial USIG GCBA',
            },
            'basemap-satellite': {
              type: 'raster',
              tiles: [BASEMAP_TILES.SATELLITE],
              tileSize: 256,
              attribution: '© Esri World Imagery (Satelital Pulmón de Manzana)',
            },
            'basemap-topo': {
              type: 'raster',
              tiles: [BASEMAP_TILES.TOPO],
              tileSize: 256,
              attribution: '© Esri World Topographic Map',
            },
          },
          layers: [
            {
              id: 'layer-street',
              type: 'raster',
              source: 'basemap-street',
              minzoom: 0,
              maxzoom: 20,
              layout: { visibility: 'visible' },
            },
            {
              id: 'layer-satellite',
              type: 'raster',
              source: 'basemap-satellite',
              minzoom: 0,
              maxzoom: 20,
              layout: { visibility: 'none' },
            },
            {
              id: 'layer-topo',
              type: 'raster',
              source: 'basemap-topo',
              minzoom: 0,
              maxzoom: 20,
              layout: { visibility: 'none' },
            },
          ],
        },
        center: [-58.4452, -34.6268], // Corazón de Caballito (Pedro Goyena / Puan)
        zoom: 13.9,
      });

      map.addControl(new maplibregl.NavigationControl(), 'top-right');
      map.addControl(
        new maplibregl.ScaleControl({ maxWidth: 120, unit: 'metric' }),
        'bottom-right'
      );

      map.on('load', () => {
        setMapReady(true);
      });

      mapRef.current = map;
    } catch {
      setMapReady(false);
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Switch basemap layer visibility without recreating map
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    if (map.getLayer('layer-street')) {
      map.setLayoutProperty(
        'layer-street',
        'visibility',
        basemap === 'STREET' ? 'visible' : 'none'
      );
    }
    if (map.getLayer('layer-satellite')) {
      map.setLayoutProperty(
        'layer-satellite',
        'visibility',
        basemap === 'SATELLITE' ? 'visible' : 'none'
      );
    }
    if (map.getLayer('layer-topo')) {
      map.setLayoutProperty(
        'layer-topo',
        'visibility',
        basemap === 'TOPO' ? 'visible' : 'none'
      );
    }
  }, [basemap, mapReady]);

  // Fly to searched address / point
  useEffect(() => {
    if (mapRef.current && mapReady && focusTarget) {
      mapRef.current.flyTo({
        center: focusTarget.coordinates,
        zoom: 16.2,
        duration: 900,
      });
    }
  }, [focusTarget, mapReady]);

  // Synchronize GeoJSON sources and layers
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const zonaA = zones.find((z) => z.zoneType === 'ZONA_A');
    const zonaB = zones.find((z) => z.zoneType === 'ZONA_B');

    const zonaAGeoJson: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features:
        zonaA && showZonaA
          ? [
              {
                type: 'Feature',
                properties: { id: zonaA.id, name: zonaA.name },
                geometry: {
                  type: 'Polygon',
                  coordinates: [zonaA.outerRing],
                },
              },
            ]
          : [],
    };

    const zonaBGeoJson: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features:
        zonaB && showZonaB
          ? [
              {
                type: 'Feature',
                properties: { id: zonaB.id, name: zonaB.name },
                geometry: {
                  type: 'Polygon',
                  coordinates: [zonaB.outerRing, ...(zonaB.holes ?? [])],
                },
              },
            ]
          : [],
    };

    const blocksGeoJson: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: showBlocks
        ? blocks.map((b) => {
            const isSelected = b.id === selectedBlockId;
            let strokeColor = '#0284c7';
            if (blockColorMode === 'SCORE') {
              strokeColor =
                b.territorialScore >= 90
                  ? '#059669'
                  : b.territorialScore >= 82
                  ? '#0284c7'
                  : '#d97706';
            } else {
              strokeColor =
                b.usdM2RefMin === null
                  ? '#9333ea'
                  : b.usdM2RefMin >= 2000
                  ? '#dc2626'
                  : b.usdM2RefMin >= 1750
                  ? '#d97706'
                  : '#059669';
            }
            return {
              type: 'Feature',
              properties: {
                id: b.id,
                label: `${b.streetName} ${b.heightRange}`,
                score: b.territorialScore,
                empty: b.activePropertyCount === 0,
                selected: isSelected,
                color: isSelected ? '#1d4ed8' : strokeColor,
              },
              geometry: {
                type: 'LineString',
                coordinates: b.coordinates,
              },
            };
          })
        : [],
    };

    const propertiesGeoJson: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: showProperties
        ? properties.map((p) => ({
            type: 'Feature',
            properties: {
              id: p.id,
              blockId: p.blockId,
              address: p.addressDisplay,
              score: p.opportunityScore,
              precision: p.locationPrecision,
              selected: p.id === selectedPropertyId,
              color:
                p.id === selectedPropertyId
                  ? '#2563eb'
                  : !p.isSynthetic
                  ? '#10b981'
                  : p.locationPrecision === 'EXACTA'
                  ? '#059669'
                  : '#eab308',
            },
            geometry: {
              type: 'Point',
              coordinates: p.coordinates,
            },
          }))
        : [],
    };

    const verticesGeoJson: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: showUsigNodes
        ? zones.flatMap((z) =>
            z.verifiedVertices.map((v) => ({
              type: 'Feature' as const,
              properties: {
                code: v.code,
                intersection: v.intersection,
                zoneType: z.zoneType,
              },
              geometry: {
                type: 'Point' as const,
                coordinates: v.coordinates,
              },
            }))
          )
        : [],
    };

    const subteGeoJson: GeoJSON.FeatureCollection = showSubte
      ? SUBTE_STATIONS_GEOJSON
      : { type: 'FeatureCollection', features: [] };

    const upsertGeoJsonSource = (id: string, data: GeoJSON.FeatureCollection) => {
      const existing = map.getSource(id) as maplibregl.GeoJSONSource | undefined;
      if (existing) {
        existing.setData(data);
      } else {
        map.addSource(id, { type: 'geojson', data });
      }
    };

    upsertGeoJsonSource('zona-b-source', zonaBGeoJson);
    upsertGeoJsonSource('zona-a-source', zonaAGeoJson);
    upsertGeoJsonSource('blocks-source', blocksGeoJson);
    upsertGeoJsonSource('subte-source', subteGeoJson);
    upsertGeoJsonSource('vertices-source', verticesGeoJson);
    upsertGeoJsonSource('properties-source', propertiesGeoJson);

    if (!map.getLayer('zona-b-fill')) {
      map.addLayer({
        id: 'zona-b-fill',
        type: 'fill',
        source: 'zona-b-source',
        paint: {
          'fill-color': '#f59e0b',
          'fill-opacity': 0.16,
        },
      });
      map.addLayer({
        id: 'zona-b-outline',
        type: 'line',
        source: 'zona-b-source',
        paint: {
          'line-color': '#d97706',
          'line-width': 3,
          'line-dasharray': [3, 2],
        },
      });
    }

    if (!map.getLayer('zona-a-fill')) {
      map.addLayer({
        id: 'zona-a-fill',
        type: 'fill',
        source: 'zona-a-source',
        paint: {
          'fill-color': '#10b981',
          'fill-opacity': 0.24,
        },
      });
      map.addLayer({
        id: 'zona-a-outline',
        type: 'line',
        source: 'zona-a-source',
        paint: {
          'line-color': '#059669',
          'line-width': 3.5,
        },
      });
    }

    if (!map.getLayer('blocks-line')) {
      map.addLayer({
        id: 'blocks-line',
        type: 'line',
        source: 'blocks-source',
        layout: {
          'line-cap': 'round',
          'line-join': 'round',
        },
        paint: {
          'line-color': ['get', 'color'],
          'line-width': ['case', ['get', 'selected'], 10, 6.5],
          'line-opacity': 0.92,
        },
      });

      map.on('click', 'blocks-line', (e) => {
        const feat = e.features?.[0];
        if (feat?.properties?.id) {
          onSelectBlock(String(feat.properties.id));
        }
      });

      map.on('mouseenter', 'blocks-line', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'blocks-line', () => {
        map.getCanvas().style.cursor = '';
      });
    }

    if (!map.getLayer('subte-circle')) {
      map.addLayer({
        id: 'subte-circle',
        type: 'circle',
        source: 'subte-source',
        paint: {
          'circle-radius': 6,
          'circle-color': '#a855f7',
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
        },
      });
    }

    if (!map.getLayer('vertices-circle')) {
      map.addLayer({
        id: 'vertices-circle',
        type: 'circle',
        source: 'vertices-source',
        paint: {
          'circle-radius': 5,
          'circle-color': '#0f172a',
          'circle-stroke-width': 2,
          'circle-stroke-color': '#38bdf8',
        },
      });
    }

    if (!map.getLayer('properties-circle')) {
      map.addLayer({
        id: 'properties-circle',
        type: 'circle',
        source: 'properties-source',
        paint: {
          'circle-radius': ['case', ['get', 'selected'], 12, 9],
          'circle-color': ['get', 'color'],
          'circle-stroke-width': 3,
          'circle-stroke-color': '#ffffff',
        },
      });

      map.on('click', 'properties-circle', (e) => {
        const feat = e.features?.[0];
        if (feat?.properties?.id && feat?.properties?.blockId) {
          onSelectProperty(
            String(feat.properties.id),
            String(feat.properties.blockId)
          );
        }
      });

      map.on('mouseenter', 'properties-circle', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'properties-circle', () => {
        map.getCanvas().style.cursor = '';
      });
    }
  }, [
    zones,
    blocks,
    properties,
    selectedBlockId,
    selectedPropertyId,
    showZonaA,
    showZonaB,
    showBlocks,
    showProperties,
    showSubte,
    showUsigNodes,
    blockColorMode,
    mapReady,
    onSelectBlock,
    onSelectProperty,
  ]);

  const selectedBlock = blocks.find((b) => b.id === selectedBlockId) ?? blocks[0];

  return (
    <div className="map-stage">
      <div ref={mapContainerRef} className="maplibre-container" />

      {/* Top-Left Layer & Polygon Controls */}
      <div className="map-overlay-top-left">
        <div className="layer-card">
          <h4>
            <span>Capas y Mapa Base (Sin API Key)</span>
            <button
              className="btn"
              style={{ padding: '2px 7px', fontSize: '10px' }}
              onClick={() => setEditGeometryOpen((v) => !v)}
            >
              {editGeometryOpen ? 'Cerrar Editor GIS' : 'Corregir Polígonos A/B'}
            </button>
          </h4>

          {/* Basemap Selector (Street / Satellite / Topo) */}
          <div style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
            <button
              className={`btn ${basemap === 'STREET' ? 'btn-primary' : ''}`}
              style={{ flex: 1, justifyContent: 'center', padding: '4px 6px', fontSize: '11px' }}
              onClick={() => setBasemap('STREET')}
            >
              Callejero CABA
            </button>
            <button
              className={`btn ${basemap === 'SATELLITE' ? 'btn-primary' : ''}`}
              style={{ flex: 1, justifyContent: 'center', padding: '4px 6px', fontSize: '11px' }}
              onClick={() => setBasemap('SATELLITE')}
            >
              Satelital (Patios/Techos)
            </button>
            <button
              className={`btn ${basemap === 'TOPO' ? 'btn-primary' : ''}`}
              style={{ flex: 1, justifyContent: 'center', padding: '4px 6px', fontSize: '11px' }}
              onClick={() => setBasemap('TOPO')}
            >
              Topográfico
            </button>
          </div>

          <div className="layer-toggles">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={showZonaA}
                onChange={(e) => setShowZonaA(e.target.checked)}
              />
              <span
                className="legend-dot"
                style={{ backgroundColor: '#10b981' }}
              />
              Zona A Prioritaria (Aranguren–Eva Perón)
            </label>

            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={showZonaB}
                onChange={(e) => setShowZonaB(e.target.checked)}
              />
              <span
                className="legend-dot"
                style={{ backgroundColor: '#f59e0b' }}
              />
              Zona B Secundaria (Diferencia sin solape)
            </label>

            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={showBlocks}
                onChange={(e) => setShowBlocks(e.target.checked)}
              />
              <span
                className="legend-line"
                style={{ backgroundColor: '#0284c7' }}
              />
              Grilla de Cuadras ({blocks.length} tramos · incl. sin avisos)
            </label>

            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={showProperties}
                onChange={(e) => setShowProperties(e.target.checked)}
              />
              <span
                className="legend-dot"
                style={{ backgroundColor: '#10b981', border: '2px solid #ffffff' }}
              />
              Propiedades Elegibles ({properties.length})
            </label>

            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={showSubte}
                onChange={(e) => setShowSubte(e.target.checked)}
              />
              <span
                className="legend-dot"
                style={{ backgroundColor: '#a855f7', border: '2px solid #ffffff' }}
              />
              Estaciones Subte A / Subte E / FFCC Sarmiento (9)
            </label>

            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={showUsigNodes}
                onChange={(e) => setShowUsigNodes(e.target.checked)}
              />
              <span
                className="legend-dot"
                style={{ backgroundColor: '#0f172a', border: '2px solid #38bdf8' }}
              />
              Vértices Verificados USIG GCBA
            </label>
          </div>

          <div
            style={{
              marginTop: '8px',
              paddingTop: '8px',
              borderTop: '1px solid rgba(51,65,85,0.8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '11px',
            }}
          >
            <span style={{ color: '#94a3b8' }}>Colorear cuadras por:</span>
            <select
              className="filter-select"
              value={blockColorMode}
              onChange={(e) =>
                setBlockColorMode(e.target.value as 'SCORE' | 'USD_M2')
              }
            >
              <option value="SCORE">Ranking Territorial (0–100)</option>
              <option value="USD_M2">Rango USD/m² Pedido (y N/D)</option>
            </select>
          </div>
        </div>

        {editGeometryOpen && (
          <div className="layer-card">
            <h4>Parametrización y Corrección de Límites A/B</h4>
            <p style={{ fontSize: '11px', color: '#cbd5e1', marginBottom: '8px' }}>
              En Caballito, <strong>Emilio Mitre</strong> y{' '}
              <strong>Malvinas Argentinas</strong> cambian de nombre al cruzar Av.
              Rivadavia y las vías del Sarmiento hacia{' '}
              <strong>Dr. Juan F. Aranguren</strong>. Elegí la hipótesis o ajustá
              el borde norte:
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <button
                className={`btn ${
                  activeVariant === 'ARANGUREN_COMPLETA' ? 'btn-emerald' : ''
                }`}
                onClick={() => onChangeVariant('ARANGUREN_COMPLETA')}
              >
                Variante 1: Completa hasta Aranguren (vía N. Oroño / Repetto)
              </button>
              <button
                className={`btn ${
                  activeVariant === 'RIVADAVIA_SUR_ESTRICTA' ? 'btn-amber' : ''
                }`}
                onClick={() => onChangeVariant('RIVADAVIA_SUR_ESTRICTA')}
              >
                Variante 2: Estricta al Sur de Av. Rivadavia → Eva Perón
              </button>
              <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                <button
                  className="btn"
                  style={{ flex: 1 }}
                  onClick={() => onApplyCustomNorthOffset(0.0012)}
                >
                  +1 Cuadra Norte (Zona A)
                </button>
                <button
                  className="btn"
                  style={{ flex: 1 }}
                  onClick={() => onApplyCustomNorthOffset(-0.0012)}
                >
                  -1 Cuadra Norte (Zona A)
                </button>
                <button className="btn" onClick={onResetCustomGeometry}>
                  Reset USIG
                </button>
              </div>
              <div
                style={{
                  fontSize: '10px',
                  color: '#6ee7b7',
                  marginTop: '2px',
                }}
              >
                ✓ Zona B se recalcula automáticamente como diferencia (Perímetro
                General − Zona A) sin superposición.
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom-Left Quick Block Selector Bar */}
      <div className="map-overlay-bottom-left">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '6px',
          }}
        >
          <strong style={{ fontSize: '11px', color: '#38bdf8' }}>
            SELECTOR RÁPIDO DE CUADRAS (INCLUYE TRAMOS SIN PROPIEDADES Y CON N/D)
          </strong>
          {selectedBlock && (
            <a
              href={buildGoogleStreetViewUrl(
                selectedBlock.centerPoint,
                selectedBlock.streetViewHeading
              )}
              target="_blank"
              rel="noreferrer"
              className="btn btn-primary"
              style={{ padding: '2px 8px', fontSize: '11px' }}
            >
              Abrir Street View de Cuadra ↗
            </a>
          )}
        </div>
        <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
          {blocks.map((b) => {
            const isSel = b.id === selectedBlockId;
            return (
              <button
                key={b.id}
                onClick={() => {
                  onSelectBlock(b.id);
                  if (mapRef.current && mapReady) {
                    mapRef.current.flyTo({
                      center: b.centerPoint,
                      zoom: 15.8,
                      duration: 600,
                    });
                  }
                }}
                className="btn"
                style={{
                  padding: '3px 7px',
                  fontSize: '11px',
                  borderColor: isSel
                    ? '#38bdf8'
                    : b.activePropertyCount === 0
                    ? '#64748b'
                    : '#10b981',
                  background: isSel
                    ? 'rgba(56, 189, 248, 0.22)'
                    : 'rgba(15, 23, 42, 0.8)',
                }}
              >
                <span>
                  {b.streetName} {b.heightRange}
                </span>
                <span
                  style={{
                    fontSize: '10px',
                    color:
                      b.activePropertyCount === 0 ? '#94a3b8' : '#6ee7b7',
                  }}
                >
                  ({b.activePropertyCount} prop · S:{b.territorialScore}
                  {b.usdM2RefMin === null ? ' · N/D' : ''})
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
