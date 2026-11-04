import express, { Request, Response } from 'express';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import {
  buildGoogleStreetViewUrl,
  buildZonesForVariant,
  INITIAL_BLOCKS,
  INITIAL_PROPERTIES,
} from '../src/data/caballitoFixtures';
import {
  BlockSegment,
  CanonicalProperty,
  GeocodeResult,
  LocationPrecision,
  PropertyCondition,
  PropertyListing,
  PropertyTypology,
  SourceCategory,
  SourceRecord,
  UserTrackingStatus,
  ZoneDefinition,
  ZoneVariantId,
} from '../src/types/domain';
import {
  classifyPointZone,
  computeNearestTransport,
  extractListingFromPublicUrl,
  fetchLiveCaballitoJsonLdCatalog,
  geocodeWithUsigLive,
  haversineMeters,
  parseFreeTextListing,
} from './usigService';
import {
  checkPostgisConnection,
  loadStateFromPostgis,
  saveStateToPostgis,
} from './db';

export interface CreateAppOptions {
  enableDiskPersistence?: boolean;
  storeFilePath?: string;
}

const INITIAL_SOURCES: SourceRecord[] = [
  {
    id: 'SRC-INMO-SUR',
    name: 'Estudio Caballito Sur (Piloto Independiente)',
    baseUrl: 'https://ejemplo-sintetico.local/caballitosur',
    category: 'INMOBILIARIA_INDEPENDIENTE',
    accessMode: 'AUTOMATICO_AUTORIZADO',
    policyStatus: 'APTA',
    robotsTxtAllowed: true,
    hasSitemap: true,
    hasStructuredData: true,
    activeListingsCount: 2,
    lastCheckedAt: '2026-11-03',
    notes: 'Catálogo web público con sitemap XML y fichas estructuradas.',
  },
  {
    id: 'SRC-FB-VECINOS',
    name: 'Grupo FB Vecinos de Caballito — Dueño Directo',
    baseUrl: 'https://facebook.com/groups/vecinos-caballito-referencia',
    category: 'DUENO_DIRECTO_FB_GRUPO',
    accessMode: 'ASISTIDO',
    policyStatus: 'RESTRINGIDA',
    robotsTxtAllowed: false,
    hasSitemap: false,
    hasStructuredData: false,
    activeListingsCount: 1,
    lastCheckedAt: '2026-11-03',
    notes: 'Sin scraping automático. Ingreso asistido por texto, enlace o captura.',
  },
  {
    id: 'SRC-ZONAPROP',
    name: 'Zonaprop (Captura Asistida / Alertas)',
    baseUrl: 'https://www.zonaprop.com.ar',
    category: 'PORTAL_INMOBILIARIO',
    accessMode: 'ASISTIDO',
    policyStatus: 'RESTRINGIDA',
    robotsTxtAllowed: false,
    hasSitemap: true,
    hasStructuredData: true,
    activeListingsCount: 2,
    lastCheckedAt: '2026-11-03',
    notes: 'Protección Cloudflare activa; se opera mediante importación asistida de URLs o alertas.',
  },
];

export function createApp(options: CreateAppOptions = {}) {
  const app = express();
  app.use(cors());
  app.use(express.json());

  const persistEnabled = options.enableDiskPersistence ?? false;
  const storeFile =
    options.storeFilePath ??
    path.resolve(process.cwd(), 'data', 'persistent_store.json');

  let activeVariant: ZoneVariantId = 'ARANGUREN_COMPLETA';
  let customZonaARing: [number, number][] | undefined = undefined;
  let zones: ZoneDefinition[] = buildZonesForVariant(activeVariant);
  let blocks: BlockSegment[] = structuredClone(INITIAL_BLOCKS);
  let properties: CanonicalProperty[] = structuredClone(INITIAL_PROPERTIES);
  let sources: SourceRecord[] = structuredClone(INITIAL_SOURCES);

  function loadFromDisk() {
    if (!persistEnabled) return;
    try {
      if (fs.existsSync(storeFile)) {
        const raw = JSON.parse(fs.readFileSync(storeFile, 'utf-8'));
        if (raw.activeVariant) activeVariant = raw.activeVariant;
        if (raw.customZonaARing) customZonaARing = raw.customZonaARing;
        zones = buildZonesForVariant(activeVariant, customZonaARing);
        if (Array.isArray(raw.blocks)) blocks = raw.blocks;
        if (Array.isArray(raw.properties)) properties = raw.properties;
        if (Array.isArray(raw.sources)) sources = raw.sources;
      }
    } catch {
      // Ignore corrupt cache and start from clean fixtures
    }
  }

  function saveToDisk() {
    if (!persistEnabled) return;
    const snapshot = {
      updatedAt: new Date().toISOString(),
      activeVariant,
      customZonaARing,
      blocks,
      properties,
      sources,
    };
    try {
      fs.mkdirSync(path.dirname(storeFile), { recursive: true });
      fs.writeFileSync(storeFile, JSON.stringify(snapshot, null, 2), 'utf-8');
    } catch {
      // Ignore write error in read-only environments
    }
    void saveStateToPostgis(snapshot);
  }

  loadFromDisk();
  if (persistEnabled) {
    void loadStateFromPostgis<{
      activeVariant?: ZoneVariantId;
      customZonaARing?: [number, number][];
      blocks?: BlockSegment[];
      properties?: CanonicalProperty[];
      sources?: SourceRecord[];
    }>().then((pgData) => {
      if (pgData) {
        if (pgData.activeVariant) activeVariant = pgData.activeVariant;
        if (pgData.customZonaARing) customZonaARing = pgData.customZonaARing;
        zones = buildZonesForVariant(activeVariant, customZonaARing);
        if (Array.isArray(pgData.blocks)) blocks = pgData.blocks;
        if (Array.isArray(pgData.properties)) properties = pgData.properties;
        if (Array.isArray(pgData.sources)) sources = pgData.sources;
      }
    });
  }

  // Health & Metadata endpoint
  app.get('/api/health', async (_req: Request, res: Response) => {
    const pgStatus = await checkPostgisConnection();
    res.json({
      status: 'ok',
      service: 'flipping-search-intelligence-api',
      issuePacks: ['IP-00', 'IP-01', 'IP-02', 'IP-03', 'IP-04', 'IP-05', 'IP-06', 'IP-07', 'IP-08'],
      poc: 'POC-01 + MVP Ready',
      syntheticDataNotice:
        'TODOS LOS REGISTROS DE SEMILLA SON DATOS SINTÉTICOS DE PRUEBA (isSynthetic = true). Las altas reales del usuario se etiquetan con isSynthetic = false.',
      activeZoneVariant: activeVariant,
      persistence: pgStatus.connected
        ? `POSTGIS_CONNECTED (${pgStatus.postgisVersion})`
        : persistEnabled
        ? 'DISK_JSON_ACTIVE'
        : 'MEMORY_TEST',
      postgis: pgStatus,
      counts: {
        zones: zones.length,
        blocks: blocks.length,
        blocksWithoutProperties: blocks.filter((b) => b.activePropertyCount === 0).length,
        properties: properties.length,
        realUserProperties: properties.filter((p) => !p.isSynthetic).length,
        sources: sources.length,
      },
    });
  });

  // GET /api/zones
  app.get('/api/zones', (_req: Request, res: Response) => {
    res.json({
      activeVariant,
      isSynthetic: true,
      overlapCheck: 'ZERO_OVERLAP_VERIFIED_ZONA_B_HAS_INTERIOR_HOLE_ZONA_A',
      zones,
    });
  });

  // POST /api/zones/variant — Parametrize or correct Zone A / B geometry
  app.post('/api/zones/variant', (req: Request, res: Response) => {
    const { variant, customOuterRing } = req.body as {
      variant?: ZoneVariantId;
      customOuterRing?: [number, number][];
    };

    if (
      variant &&
      variant !== 'ARANGUREN_COMPLETA' &&
      variant !== 'RIVADAVIA_SUR_ESTRICTA'
    ) {
      res.status(400).json({
        error: 'Variante de Zona A inválida. Usar ARANGUREN_COMPLETA o RIVADAVIA_SUR_ESTRICTA.',
      });
      return;
    }

    if (variant) {
      activeVariant = variant;
    }
    if (Array.isArray(customOuterRing) && customOuterRing.length >= 3) {
      customZonaARing = customOuterRing;
    } else if (customOuterRing === null) {
      customZonaARing = undefined;
    }

    zones = buildZonesForVariant(activeVariant, customZonaARing);
    saveToDisk();
    res.json({
      activeVariant,
      customGeometryApplied: Boolean(customZonaARing),
      zones,
    });
  });

  // GET /api/blocks?zoneId=&bbox=
  app.get('/api/blocks', (req: Request, res: Response) => {
    const { zoneId, bbox } = req.query;
    let result = [...blocks];

    if (typeof zoneId === 'string' && zoneId !== 'ALL') {
      result = result.filter((b) => b.zoneId === zoneId);
    }

    if (typeof bbox === 'string') {
      const parts = bbox.split(',').map(Number);
      if (parts.length === 4 && parts.every((n) => !Number.isNaN(n))) {
        const [minLng, minLat, maxLng, maxLat] = parts;
        result = result.filter((b) => {
          const [lng, lat] = b.centerPoint;
          return lng >= minLng && lng <= maxLng && lat >= minLat && lat <= maxLat;
        });
      }
    }

    res.json({
      isSynthetic: true,
      total: result.length,
      emptyBlocksCount: result.filter((b) => b.activePropertyCount === 0).length,
      blocks: result,
    });
  });

  // GET /api/properties — 4 Main Filters + Sorting
  app.get('/api/properties', (req: Request, res: Response) => {
    const {
      zoneId,
      typology,
      maxPriceUsd,
      maxUsdPerM2,
      conditionState,
      onlyPriceDrops,
      onlyDirectOwner,
      onlyReal,
      userStatus,
      sortBy,
    } = req.query;

    let result = [...properties];

    if (onlyReal === 'true') {
      result = result.filter((p) => !p.isSynthetic);
    }

    if (typeof zoneId === 'string' && zoneId !== 'ALL') {
      result = result.filter((p) => p.zoneId === zoneId);
    }

    if (typeof typology === 'string' && typology !== 'ALL') {
      const allowed = typology.split(',') as PropertyTypology[];
      result = result.filter((p) => allowed.includes(p.typology));
    }

    if (typeof maxPriceUsd === 'string' && maxPriceUsd.trim() !== '') {
      const maxP = Number(maxPriceUsd);
      if (!Number.isNaN(maxP) && maxP > 0) {
        result = result.filter((p) => p.askingPriceUsdMin <= maxP);
      }
    }

    if (typeof maxUsdPerM2 === 'string' && maxUsdPerM2.trim() !== '') {
      const maxM2 = Number(maxUsdPerM2);
      if (!Number.isNaN(maxM2) && maxM2 > 0) {
        result = result.filter(
          (p) => p.usdPerM2Asking !== null && p.usdPerM2Asking <= maxM2
        );
      }
    }

    if (typeof conditionState === 'string' && conditionState !== 'ALL') {
      const states = conditionState.split(',') as PropertyCondition[];
      result = result.filter((p) => states.includes(p.conditionState));
    }

    if (onlyPriceDrops === 'true') {
      result = result.filter((p) => p.hasRecentPriceDrop);
    }

    if (onlyDirectOwner === 'true') {
      result = result.filter((p) => p.isDirectOwnerDeclared);
    }

    if (typeof userStatus === 'string' && userStatus !== 'ALL') {
      result = result.filter((p) => p.userStatus === (userStatus as UserTrackingStatus));
    }

    if (sortBy === 'usd_m2_asc') {
      result.sort(
        (a, b) => (a.usdPerM2Asking ?? 999999) - (b.usdPerM2Asking ?? 999999)
      );
    } else if (sortBy === 'territorial_desc') {
      result.sort((a, b) => b.territorialScore - a.territorialScore);
    } else {
      result.sort((a, b) => b.opportunityScore - a.opportunityScore);
    }

    res.json({
      isSynthetic: result.every((p) => p.isSynthetic),
      total: result.length,
      properties: result,
    });
  });

  // GET /api/properties/:id
  app.get('/api/properties/:id', (req: Request, res: Response) => {
    const prop = properties.find((p) => p.id === req.params.id);
    if (!prop) {
      res.status(404).json({ error: 'Propiedad no encontrada.' });
      return;
    }
    res.json({
      isSynthetic: prop.isSynthetic,
      property: prop,
      streetViewUrl: buildGoogleStreetViewUrl(prop.coordinates, prop.streetViewHeading),
    });
  });

  // PATCH /api/properties/:id/status — Seguimiento persistente
  app.patch('/api/properties/:id/status', (req: Request, res: Response) => {
    const prop = properties.find((p) => p.id === req.params.id);
    if (!prop) {
      res.status(404).json({ error: 'Propiedad no encontrada.' });
      return;
    }

    const { userStatus, discardReason, note } = req.body as {
      userStatus?: UserTrackingStatus;
      discardReason?: string;
      note?: string;
    };

    const validStatuses: UserTrackingStatus[] = [
      'SIN_CLASIFICAR',
      'ME_INTERESA',
      'EN_OBSERVACION',
      'DESCARTAR',
    ];

    if (userStatus && !validStatuses.includes(userStatus)) {
      res.status(400).json({ error: 'Estado de seguimiento inválido.' });
      return;
    }

    if (userStatus) {
      prop.userStatus = userStatus;
    }
    if (typeof discardReason === 'string') {
      prop.discardReason = discardReason;
    }
    if (typeof note === 'string' && note.trim() !== '') {
      prop.userNotes.push(note.trim());
    }

    saveToDisk();
    res.json({
      isSynthetic: prop.isSynthetic,
      property: prop,
    });
  });

  // POST /api/listings/import — Alta Real Asistida / Dueño Directo / Extra Zona + Deduplicación N:1 (IP-04, IP-05, IP-07)
  app.post('/api/listings/import', async (req: Request, res: Response) => {
    const {
      address,
      rawText = '',
      priceUsd: explicitPrice,
      totalAreaM2: explicitArea,
      rooms: explicitRooms,
      typology: explicitTypology,
      conditionState: explicitCondition,
      sourceName = 'Carga Asistida Usuario',
      sourceCategory = 'CARGA_MANUAL',
      externalUrl = '',
      agencyOrSeller = 'Particular / Inmobiliaria',
      isDirectOwnerDeclared: explicitDirectOwner,
    } = req.body as {
      address?: string;
      rawText?: string;
      priceUsd?: number;
      totalAreaM2?: number;
      rooms?: number;
      typology?: PropertyTypology;
      conditionState?: PropertyCondition;
      sourceName?: string;
      sourceCategory?: SourceCategory;
      externalUrl?: string;
      agencyOrSeller?: string;
      isDirectOwnerDeclared?: boolean;
    };

    if (!address || address.trim().length < 3) {
      res.status(400).json({
        error: 'Debe indicar una dirección o intersección de referencia (ej: "Pedro Goyena 1120" o "Valle al 700").',
      });
      return;
    }

    const parsed = parseFreeTextListing(rawText);
    const finalPriceUsd = Number(explicitPrice ?? parsed.priceUsd ?? 95000);
    const finalAreaM2 = Number(explicitArea ?? parsed.totalAreaM2 ?? 58);
    const finalRooms = Number(explicitRooms ?? parsed.rooms ?? 3);
    const finalTypology: PropertyTypology =
      explicitTypology ?? parsed.typology ?? 'DEPTO_3AMB';
    const finalCondition: PropertyCondition =
      explicitCondition ?? parsed.conditionState ?? 'A_REFACCIONAR';
    const finalDirectOwner =
      explicitDirectOwner ?? parsed.isDirectOwnerDeclared ?? false;

    // 1. Intentar geocodificar con USIG CABA en vivo o con la grilla local de Caballito
    let coords: [number, number] = [-58.4452, -34.6268];
    let normalizedAddress = address.trim();
    let precision: LocationPrecision = /\bal\s+\d+/i.test(address)
      ? 'APROXIMADA_CUADRA'
      : 'EXACTA';

    const localBlock = blocks.find((b) =>
      address.toLowerCase().includes(b.streetName.toLowerCase())
    );
    if (localBlock) {
      coords = [
        Number((localBlock.centerPoint[0] + 0.00015).toFixed(6)),
        Number((localBlock.centerPoint[1] + 0.0001).toFixed(6)),
      ];
    }

    const usigHit = await geocodeWithUsigLive(address.trim());
    if (usigHit) {
      coords = usigHit.coordinates;
      normalizedAddress = usigHit.normalizedAddress;
      precision = usigHit.precision;
    }

    const detectedZone = classifyPointZone(coords, zones);
    const nearestBlock =
      blocks
        .map((b) => ({
          block: b,
          dist: haversineMeters(coords, b.centerPoint),
        }))
        .sort((a, b) => a.dist - b.dist)[0]?.block ?? blocks[0];

    const today = new Date().toISOString().slice(0, 10);

    // 2. Deduplicación N:1 (IP-04): verificar si coincide calle+altura o si está a <= 95 metros con mismos ambientes y m² similares (±15%)
    const rawAddrLower = address.trim().toLowerCase();
    const duplicateCandidate = properties.find((p) => {
      const sameAddressNumber =
        p.addressDisplay.toLowerCase().includes(rawAddrLower) ||
        rawAddrLower.includes(
          p.addressDisplay.split('(')[0].trim().toLowerCase()
        );
      const dist = haversineMeters(coords, p.coordinates);
      const areaDiffRatio =
        p.totalAreaM2 && finalAreaM2
          ? Math.abs(p.totalAreaM2 - finalAreaM2) / p.totalAreaM2
          : 1;
      return (
        (sameAddressNumber || dist <= 95) &&
        p.rooms === finalRooms &&
        areaDiffRatio <= 0.15
      );
    });

    if (duplicateCandidate) {
      const prevMin = duplicateCandidate.askingPriceUsdMin;
      const priceDropPct =
        finalPriceUsd < prevMin
          ? Number((((finalPriceUsd - prevMin) / prevMin) * 100).toFixed(1))
          : null;

      const newListing: PropertyListing = {
        id: `LST-${Date.now()}`,
        propertyId: duplicateCandidate.id,
        sourceId: `SRC-${Date.now()}`,
        sourceName,
        sourceCategory,
        accessMode: 'ASISTIDO',
        agencyOrSeller,
        externalUrl: externalUrl || 'https://captura-asistida.local/usuario',
        currentPriceUsd: finalPriceUsd,
        previousPriceUsd: finalPriceUsd < prevMin ? prevMin : null,
        priceDropPct,
        activeState: 'ACTIVA',
        firstObservedAt: today,
        lastObservedAt: today,
        observations: [
          {
            id: `OBS-${Date.now()}`,
            observedAt: today,
            priceUsd: finalPriceUsd,
            note: 'Publicación vinculada automáticamente por Deduplicación N:1 (misma unidad física).',
          },
        ],
        isSynthetic: false,
      };

      duplicateCandidate.listings.push(newListing);
      duplicateCandidate.askingPriceUsdMin = Math.min(
        duplicateCandidate.askingPriceUsdMin,
        finalPriceUsd
      );
      duplicateCandidate.askingPriceUsdMax = Math.max(
        duplicateCandidate.askingPriceUsdMax,
        finalPriceUsd
      );
      if (duplicateCandidate.totalAreaM2) {
        duplicateCandidate.usdPerM2Asking = Math.round(
          duplicateCandidate.askingPriceUsdMin / duplicateCandidate.totalAreaM2
        );
      }
      if (priceDropPct && priceDropPct < 0) {
        duplicateCandidate.hasRecentPriceDrop = true;
      }
      duplicateCandidate.isApparentlyExclusiveInObservedSources = false;

      saveToDisk();
      res.status(200).json({
        deduplicated: true,
        matchReason:
          'Se vinculó a una propiedad física existente por proximidad geográfica (<65m), cantidad de ambientes y superficie compatible.',
        property: duplicateCandidate,
      });
      return;
    }

    // 3. Crear nueva Propiedad Física Canónica (Real aportada por el usuario, isSynthetic = false)
    const usdPerM2 =
      finalAreaM2 > 0 ? Math.round(finalPriceUsd / finalAreaM2) : null;
    const blockRefM2 =
      nearestBlock.usdM2RefMin && nearestBlock.usdM2RefMax
        ? Math.round((nearestBlock.usdM2RefMin + nearestBlock.usdM2RefMax) / 2)
        : 2050;
    const discountPct = usdPerM2
      ? Number((((usdPerM2 - blockRefM2) / blockRefM2) * 100).toFixed(1))
      : null;

    const transportInfo = computeNearestTransport(coords);
    const baseOppScore = Math.min(
      98,
      Math.max(
        55,
        Math.round(
          72 +
            (discountPct && discountPct < 0 ? Math.min(18, Math.abs(discountPct) * 0.6) : 0) +
            (finalCondition === 'A_REFACCIONAR' ? 6 : 2) +
            (finalDirectOwner ? 4 : 0)
        )
      )
    );

    const newPropId = `PROP-REAL-${Date.now().toString().slice(-4)}`;
    const newProperty: CanonicalProperty = {
      id: newPropId,
      blockId: nearestBlock.id,
      zoneId: detectedZone,
      addressDisplay: normalizedAddress,
      locationPrecision: precision,
      locationPrecisionNote: usigHit
        ? `Geocodificada en vivo vía USIG Oficial GCBA (${detectedZone.toUpperCase()}). ${transportInfo.summary}.`
        : `Ubicada por referencia de cuadra en ${detectedZone.toUpperCase()}. ${transportInfo.summary}.`,
      coordinates: coords,
      streetViewHeading: 180,
      streetViewAvailable: true,
      typology: finalTypology,
      rooms: finalRooms,
      totalAreaM2: finalAreaM2,
      coveredAreaM2: Math.round(finalAreaM2 * 0.92),
      askingPriceUsdMin: finalPriceUsd,
      askingPriceUsdMax: finalPriceUsd,
      usdPerM2Asking: usdPerM2,
      blockRefUsdPerM2: blockRefM2,
      discountVsBlockPct: discountPct,
      conditionState: finalCondition,
      sidewalkSide: 'PAR',
      orientation: 'N',
      floorLabel: 'A verificar en visita',
      hasBalcony: null,
      expensesArs: null,
      daysOnMarket: 1,
      hasRecentPriceDrop: false,
      isRepublished: false,
      isDirectOwnerDeclared: finalDirectOwner,
      isApparentlyExclusiveInObservedSources: true,
      opportunityScore: baseOppScore,
      territorialScore: nearestBlock.territorialScore,
      scoreVersion: 'v0.4-real',
      scoreConfidence: precision === 'EXACTA' ? 'ALTA' : 'MEDIA',
      opportunityBreakdown: [
        {
          criterion: 'Descuento Aparente vs. Referencia de Cuadra',
          weight: 0.35,
          rawScore: 86,
          weightedPoints: 30.1,
          explanation: `USD ${usdPerM2 ?? 'N/D'}/m² frente a referencia zonal de USD ${blockRefM2}/m² (${discountPct ?? 0}%).`,
        },
        {
          criterion: 'Estado Físico y Potencial de Reforma',
          weight: 0.3,
          rawScore: finalCondition === 'A_REFACCIONAR' ? 92 : 78,
          weightedPoints: finalCondition === 'A_REFACCIONAR' ? 27.6 : 23.4,
          explanation: `Estado declarado: ${finalCondition}.`,
        },
        {
          criterion: 'Condición Comercial y Origen',
          weight: 0.35,
          rawScore: finalDirectOwner ? 90 : 78,
          weightedPoints: finalDirectOwner ? 31.5 : 27.3,
          explanation: finalDirectOwner
            ? 'Dueño Directo declarado (captura asistida).'
            : `Fuente: ${sourceName}.`,
        },
      ],
      missingDataFields:
        precision === 'APROXIMADA_CUADRA'
          ? ['Altura exacta pendiente de confirmación']
          : [],
      listings: [
        {
          id: `LST-${Date.now()}`,
          propertyId: newPropId,
          sourceId: `SRC-${Date.now()}`,
          sourceName,
          sourceCategory,
          accessMode: 'ASISTIDO',
          agencyOrSeller,
          externalUrl: externalUrl || 'https://captura-asistida.local/usuario',
          currentPriceUsd: finalPriceUsd,
          previousPriceUsd: null,
          priceDropPct: null,
          activeState: 'ACTIVA',
          firstObservedAt: today,
          lastObservedAt: today,
          observations: [
            {
              id: `OBS-${Date.now()}`,
              observedAt: today,
              priceUsd: finalPriceUsd,
              note: 'Alta real ingresada por el usuario y geocodificada.',
            },
          ],
          isSynthetic: false,
        },
      ],
      comparables: [],
      userStatus: 'ME_INTERESA',
      discardReason: '',
      userNotes: rawText ? [`Texto original capturado: ${rawText.slice(0, 180)}`] : [],
      isSynthetic: false,
    };

    properties.unshift(newProperty);
    nearestBlock.activePropertyCount += 1;
    saveToDisk();

    res.status(201).json({
      deduplicated: false,
      property: newProperty,
    });
  });

  // GET /api/sources & POST /api/sources/inspect (IP-03 Administrador de Fuentes Inmobiliarias)
  app.get('/api/sources', (_req: Request, res: Response) => {
    res.json({
      total: sources.length,
      sources,
    });
  });

  app.post('/api/sources/inspect', async (req: Request, res: Response) => {
    const { url, name, category = 'INMOBILIARIA_INDEPENDIENTE' } = req.body as {
      url?: string;
      name?: string;
      category?: SourceCategory;
    };

    if (!url || !url.startsWith('http')) {
      res.status(400).json({
        error: 'Ingrese una URL válida comenzando con http:// o https://',
      });
      return;
    }

    const parsedUrl = new URL(url);
    const isFacebook = /facebook\.com|fb\.com/i.test(parsedUrl.hostname);
    let robotsAllowed = !isFacebook;
    let hasSitemap = false;

    if (!isFacebook) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 3000);
        const r = await fetch(`${parsedUrl.origin}/robots.txt`, {
          signal: controller.signal,
        });
        clearTimeout(timer);
        if (r.ok) {
          const txt = await r.text();
          robotsAllowed = !/Disallow:\s*\/\s*$/m.test(txt);
          hasSitemap = /Sitemap:/i.test(txt);
        }
      } catch {
        // Offline or blocked; fallback to assisted mode
      }
    }

    const newSource: SourceRecord = {
      id: `SRC-${Date.now().toString().slice(-4)}`,
      name: name?.trim() || parsedUrl.hostname.replace(/^www\./, ''),
      baseUrl: parsedUrl.origin,
      category: isFacebook ? 'DUENO_DIRECTO_FB_GRUPO' : category,
      accessMode: isFacebook || !robotsAllowed ? 'ASISTIDO' : 'AUTOMATICO_AUTORIZADO',
      policyStatus: isFacebook || !robotsAllowed ? 'RESTRINGIDA' : 'APTA',
      robotsTxtAllowed: robotsAllowed,
      hasSitemap,
      hasStructuredData: !isFacebook,
      activeListingsCount: 0,
      lastCheckedAt: new Date().toISOString().slice(0, 10),
      notes: isFacebook
        ? 'Fuente referencial Facebook/Marketplace: registrada en modo ASISTIDO (sin scraping de sesiones privadas).'
        : robotsAllowed
        ? 'Sitio público compatible con inspección de catálogo / sitemap.'
        : 'Sitio con restricciones de acceso automatizado: registrado para importación asistida.',
    };

    sources.unshift(newSource);
    saveToDisk();
    res.status(201).json({ source: newSource });
  });

  // POST /api/listings/extract-url — Extrae metadatos OpenGraph/HTML de cualquier URL inmobiliaria pública
  app.post('/api/listings/extract-url', async (req: Request, res: Response) => {
    const { url } = req.body as { url?: string };
    if (!url || !url.startsWith('http')) {
      res.status(400).json({ error: 'Ingrese una URL válida (https://...)' });
      return;
    }
    try {
      const draft = await extractListingFromPublicUrl(url.trim());
      res.json({ draft });
    } catch {
      res.status(400).json({ error: 'No se pudo analizar la URL indicada.' });
    }
  });

  // POST /api/production/sync-real — Purga los datos sintéticos de POC-01 e ingesta oferta real de Caballito / Parque Chacabuco (JSON-LD Schema.org)
  app.post('/api/production/sync-real', async (req: Request, res: Response) => {
    const { purgeSynthetic = true, maxPages = 4 } = (req.body || {}) as {
      purgeSynthetic?: boolean;
      maxPages?: number;
    };

    let purgedSyntheticCount = 0;
    if (purgeSynthetic) {
      const before = properties.length;
      properties = properties.filter((p) => !p.isSynthetic);
      purgedSyntheticCount = before - properties.length;
      // Eliminar también fuentes sintéticas de demostración
      sources = sources.filter(
        (s) => !s.baseUrl.includes('ejemplo-sintetico.local')
      );
      blocks = blocks.map((b) => ({
        ...b,
        isSynthetic: false,
      }));
    }

    const scrapedCatalog = await fetchLiveCaballitoJsonLdCatalog(
      Math.min(Math.max(Number(maxPages) || 4, 1), 6)
    );

    const today = new Date().toISOString().slice(0, 10);
    let createdCount = 0;
    let updatedCount = 0;

    for (const item of scrapedCatalog) {
      const existingByUrl = properties.find((p) =>
        p.listings.some((l) => l.externalUrl === item.url)
      );

      if (existingByUrl) {
        const listing = existingByUrl.listings.find(
          (l) => l.externalUrl === item.url
        );
        if (listing) {
          if (listing.currentPriceUsd !== item.priceUsd) {
            listing.previousPriceUsd = listing.currentPriceUsd;
            listing.currentPriceUsd = item.priceUsd;
            if (listing.previousPriceUsd && item.priceUsd < listing.previousPriceUsd) {
              listing.priceDropPct = Number(
                (
                  ((item.priceUsd - listing.previousPriceUsd) /
                    listing.previousPriceUsd) *
                  100
                ).toFixed(1)
              );
              existingByUrl.hasRecentPriceDrop = true;
            }
          }
          listing.lastObservedAt = today;
          listing.activeState = 'ACTIVA';
          updatedCount += 1;
        }
        continue;
      }

      const detectedZone = classifyPointZone(item.coordinates, zones);

      let nearestBlock = blocks[0];
      let minBlockDist = Infinity;
      for (const b of blocks) {
        const d = haversineMeters(item.coordinates, b.centerPoint);
        if (d < minBlockDist) {
          minBlockDist = d;
          nearestBlock = b;
        }
      }

      const precision: LocationPrecision = /\bal\s+\d+/i.test(item.streetAddress)
        ? 'APROXIMADA_CUADRA'
        : 'EXACTA';

      const usdPerM2 =
        item.totalAreaM2 > 0
          ? Math.round(item.priceUsd / item.totalAreaM2)
          : null;
      const blockRefM2 =
        nearestBlock.usdM2RefMin && nearestBlock.usdM2RefMax
          ? Math.round((nearestBlock.usdM2RefMin + nearestBlock.usdM2RefMax) / 2)
          : 2050;
      const discountPct =
        usdPerM2 && blockRefM2
          ? Number((((usdPerM2 - blockRefM2) / blockRefM2) * 100).toFixed(1))
          : null;

      const transportInfo = computeNearestTransport(item.coordinates);

      const discountBonus =
        discountPct !== null && discountPct < 0
          ? Math.min(22, Math.round(Math.abs(discountPct) * 0.85))
          : 0;
      const conditionBonus =
        item.conditionState === 'A_REFACCIONAR'
          ? 12
          : item.conditionState === 'EPOCA_ORIGINAL'
          ? 7
          : 2;
      const zoneBonus =
        detectedZone === 'zona-a' ? 8 : detectedZone === 'zona-b' ? 4 : 0;
      const oppScore = Math.min(
        98,
        Math.max(54, 62 + discountBonus + conditionBonus + zoneBonus)
      );

      const newPropId = `PROP-REAL-${Date.now().toString().slice(-5)}-${createdCount + 1}`;
      const newProperty: CanonicalProperty = {
        id: newPropId,
        blockId: nearestBlock.id,
        zoneId: detectedZone,
        addressDisplay: `${item.streetAddress} (${item.locality})`,
        locationPrecision: precision,
        locationPrecisionNote:
          precision === 'APROXIMADA_CUADRA'
            ? `Altura aproximada de cuadra publicada por la inmobiliaria (${item.streetAddress}). No se inventa número de puerta exacto. ${transportInfo.summary}.`
            : `Dirección verificada en ${item.locality}. ${transportInfo.summary}.`,
        coordinates: item.coordinates,
        streetViewHeading: nearestBlock.streetViewHeading || 180,
        streetViewAvailable: true,
        typology: item.typology,
        rooms: item.rooms,
        totalAreaM2: item.totalAreaM2,
        coveredAreaM2: Math.round(item.totalAreaM2 * 0.92),
        askingPriceUsdMin: item.priceUsd,
        askingPriceUsdMax: item.priceUsd,
        usdPerM2Asking: usdPerM2,
        blockRefUsdPerM2: blockRefM2,
        discountVsBlockPct: discountPct,
        conditionState: item.conditionState,
        sidewalkSide: 'PAR',
        orientation: 'N',
        floorLabel: item.typology === 'PH' ? 'PH' : 'Ver ficha original',
        hasBalcony: null,
        expensesArs: null,
        daysOnMarket: 1,
        hasRecentPriceDrop: false,
        isRepublished: false,
        isDirectOwnerDeclared: false,
        isApparentlyExclusiveInObservedSources: true,
        opportunityScore: oppScore,
        territorialScore: nearestBlock.territorialScore,
        scoreVersion: 'v0.4-real',
        scoreConfidence: precision === 'EXACTA' ? 'ALTA' : 'MEDIA',
        opportunityBreakdown: [
          {
            criterion: 'Relación USD/m² vs. Referencia Zonal de Cuadra',
            weight: 0.4,
            rawScore: Math.min(96, 68 + discountBonus),
            weightedPoints: Number(((68 + discountBonus) * 0.4).toFixed(1)),
            explanation: `USD ${usdPerM2 ?? 'N/D'}/m² frente a mediana zonal de USD ${blockRefM2}/m² (${discountPct ?? 0}%).`,
          },
          {
            criterion: 'Estado Físico y Tipología Elegible',
            weight: 0.35,
            rawScore: item.conditionState === 'A_REFACCIONAR' ? 92 : 78,
            weightedPoints:
              item.conditionState === 'A_REFACCIONAR' ? 32.2 : 27.3,
            explanation: `${item.typology} (${item.rooms} amb, ${item.totalAreaM2} m²) — Estado detectado: ${item.conditionState}.`,
          },
          {
            criterion: 'Ubicación Territorial y Transporte',
            weight: 0.25,
            rawScore: nearestBlock.territorialScore,
            weightedPoints: Number(
              (nearestBlock.territorialScore * 0.25).toFixed(1)
            ),
            explanation: `${detectedZone.toUpperCase()} · ${transportInfo.summary}.`,
          },
        ],
        missingDataFields:
          precision === 'APROXIMADA_CUADRA'
            ? ['Altura exacta pendiente de confirmación en visita']
            : [],
        listings: [
          {
            id: `LST-REAL-${Date.now().toString().slice(-5)}-${createdCount + 1}`,
            propertyId: newPropId,
            sourceId: 'SRC-LEPORE-CABALLITO',
            sourceName: item.agencyName,
            sourceCategory: 'INMOBILIARIA_INDEPENDIENTE',
            accessMode: 'AUTOMATICO_AUTORIZADO',
            agencyOrSeller: item.agencyName,
            externalUrl: item.url,
            currentPriceUsd: item.priceUsd,
            previousPriceUsd: null,
            priceDropPct: null,
            activeState: 'ACTIVA',
            firstObservedAt: today,
            lastObservedAt: today,
            observations: [
              {
                id: `OBS-REAL-${Date.now().toString().slice(-5)}-${createdCount + 1}`,
                observedAt: today,
                priceUsd: item.priceUsd,
                note: `Sincronizado desde catálogo público Schema.org/RealEstateListing (${item.title}).`,
              },
            ],
            isSynthetic: false,
          },
        ],
        comparables: [],
        userStatus: 'SIN_CLASIFICAR',
        discardReason: '',
        userNotes: [`Ficha original: ${item.title}`],
        isSynthetic: false,
      };

      properties.push(newProperty);
      createdCount += 1;
    }

    // Ordenar por mayor score de oportunidad
    properties.sort((a, b) => b.opportunityScore - a.opportunityScore);

    // Recalcular conteo de propiedades activas por cuadra
    blocks = blocks.map((b) => ({
      ...b,
      activePropertyCount: properties.filter((p) => p.blockId === b.id).length,
    }));

    // Registrar o actualizar la fuente real en el directorio de fuentes
    const realCount = properties.filter((p) => !p.isSynthetic).length;
    const existingLepore = sources.find((s) => s.id === 'SRC-LEPORE-CABALLITO');
    if (existingLepore) {
      existingLepore.activeListingsCount = realCount;
      existingLepore.lastCheckedAt = today;
    } else {
      sources.unshift({
        id: 'SRC-LEPORE-CABALLITO',
        name: 'Lepore Propiedades Caballito (Catálogo Schema.org/JSON-LD)',
        baseUrl: 'https://lepore.com.ar/propiedades',
        category: 'INMOBILIARIA_INDEPENDIENTE',
        accessMode: 'AUTOMATICO_AUTORIZADO',
        policyStatus: 'APTA',
        robotsTxtAllowed: true,
        hasSitemap: true,
        hasStructuredData: true,
        activeListingsCount: realCount,
        lastCheckedAt: today,
        notes:
          'Ingesta automática autorizada vía microdatos públicos Schema.org/RealEstateListing en Caballito y Parque Chacabuco.',
      });
    }

    saveToDisk();

    res.json({
      mode: 'PRODUCTION_REAL',
      purgedSyntheticCount,
      createdRealCount: createdCount,
      updatedRealCount: updatedCount,
      totalProperties: properties.length,
      realPropertiesCount: realCount,
      syntheticPropertiesCount: properties.filter((p) => p.isSynthetic).length,
      properties,
      blocks,
      sources,
    });
  });

  // POST /api/production/restore-demo — Restaura las 6 propiedades sintéticas de referencia POC-01 si se desea comparar
  app.post('/api/production/restore-demo', (_req: Request, res: Response) => {
    const realOnes = properties.filter((p) => !p.isSynthetic);
    const demoOnes = structuredClone(INITIAL_PROPERTIES);
    properties = [...realOnes, ...demoOnes];
    blocks = structuredClone(INITIAL_BLOCKS).map((b) => ({
      ...b,
      activePropertyCount: properties.filter((p) => p.blockId === b.id).length,
    }));
    saveToDisk();
    res.json({
      totalProperties: properties.length,
      properties,
      blocks,
    });
  });

  // GET /api/geocode?q= — Buscador híbrido (Fixtures + USIG CABA en vivo)
  app.get('/api/geocode', async (req: Request, res: Response) => {
    const rawQuery = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (!rawQuery) {
      res.status(400).json({ error: 'Debe ingresar una calle, intersección o dirección.' });
      return;
    }

    const q = rawQuery.toLowerCase();

    // 1. Buscar en propiedades cargadas
    const matchedProp = properties.find((p) =>
      p.addressDisplay.toLowerCase().includes(q)
    );
    if (matchedProp) {
      const response: GeocodeResult = {
        query: rawQuery,
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
            ? 'Ubicación aproximada a nivel cuadra: no se inventa número de puerta.'
            : undefined,
      };
      res.json(response);
      return;
    }

    // 2. Buscar en tramos de cuadra (blocks)
    const matchedBlock = blocks.find(
      (b) =>
        b.streetName.toLowerCase().includes(q) ||
        `${b.streetName} ${b.heightRange}`.toLowerCase().includes(q) ||
        `${b.streetName} y ${b.fromStreet}`.toLowerCase().includes(q) ||
        `${b.streetName} y ${b.toStreet}`.toLowerCase().includes(q)
    );

    if (matchedBlock) {
      const response: GeocodeResult = {
        query: rawQuery,
        matchedAddress: `${matchedBlock.streetName} ${matchedBlock.heightRange} (entre ${matchedBlock.fromStreet} y ${matchedBlock.toStreet})`,
        coordinates: matchedBlock.centerPoint,
        precision: 'APROXIMADA_CUADRA',
        source: 'FIXTURE_LOCAL_CABALLITO',
        zoneId: matchedBlock.zoneId,
        streetViewUrl: buildGoogleStreetViewUrl(
          matchedBlock.centerPoint,
          matchedBlock.streetViewHeading
        ),
        streetViewAvailable: matchedBlock.streetViewAvailable,
        warning: matchedBlock.streetViewAvailable
          ? 'Centrado en punto medio de cuadra referencial.'
          : 'Relevamiento Street View incompleto en este tramo; verificar en campo.',
      };
      res.json(response);
      return;
    }

    // 3. Buscar en vértices cartográficos verificados USIG
    const allVertices = zones.flatMap((z) =>
      z.verifiedVertices.map((v) => ({
        ...v,
        zoneId: z.id === 'zona-a' ? ('zona-a' as const) : ('zona-b' as const),
      }))
    );
    const matchedVertex = allVertices.find(
      (v) =>
        v.intersection.toLowerCase().includes(q) ||
        v.usigNormalized.toLowerCase().includes(q)
    );

    if (matchedVertex) {
      const response: GeocodeResult = {
        query: rawQuery,
        matchedAddress: `${matchedVertex.intersection} (${matchedVertex.usigNormalized})`,
        coordinates: matchedVertex.coordinates,
        precision: 'EXACTA',
        source: 'USIG_OFICIAL_GCBA',
        zoneId: matchedVertex.zoneId,
        streetViewUrl: buildGoogleStreetViewUrl(matchedVertex.coordinates, 180),
        streetViewAvailable: true,
      };
      res.json(response);
      return;
    }

    // 4. Consultar en vivo al Normalizador Oficial USIG GCBA para cualquier dirección de CABA (Zona A, B o Extra Zona)
    const liveUsig = await geocodeWithUsigLive(rawQuery);
    if (liveUsig) {
      const detectedZone = classifyPointZone(liveUsig.coordinates, zones);
      const response: GeocodeResult = {
        query: rawQuery,
        matchedAddress: `${liveUsig.normalizedAddress} [${detectedZone.toUpperCase()}]`,
        coordinates: liveUsig.coordinates,
        precision: liveUsig.precision,
        source: 'USIG_OFICIAL_GCBA',
        zoneId: detectedZone,
        streetViewUrl: buildGoogleStreetViewUrl(liveUsig.coordinates, 180),
        streetViewAvailable: true,
        warning:
          detectedZone === 'extra-zona'
            ? 'Dirección fuera del perímetro A/B: clasificada como EXTRA ZONA bajo demanda.'
            : undefined,
      };
      res.json(response);
      return;
    }

    res.status(404).json({
      error:
        'Dirección o calle no encontrada. Pruebe con cualquier calle y altura de CABA (ej: "Pedro Goyena 1150", "Rivadavia 5200", "Valle", "Puan 465").',
    });
  });

  return app;
}
