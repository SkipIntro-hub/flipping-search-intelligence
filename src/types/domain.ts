export type ZoneType = 'ZONA_A' | 'ZONA_B' | 'EXTRA_ZONA';

export type ValidationStatus =
  | 'VERIFICADA_GIS'
  | 'PARCIAL_CON_OBSERVACIONES'
  | 'PENDIENTE_GIS';

export type ZoneVariantId = 'ARANGUREN_COMPLETA' | 'RIVADAVIA_SUR_ESTRICTA';

export interface VerifiedVertex {
  code: string;
  intersection: string;
  coordinates: [number, number]; // [lng, lat]
  usigNormalized: string;
  note: string;
}

export interface ZoneDefinition {
  id: string;
  name: string;
  zoneType: ZoneType;
  priority: number;
  validationStatus: ValidationStatus;
  boundaryNotes: string;
  nominalLimits: {
    north: string;
    south: string;
    east: string;
    west: string;
  };
  outerRing: [number, number][];
  holes?: [number, number][][];
  verifiedVertices: VerifiedVertex[];
  isSynthetic: boolean;
}

export interface SidewalkDetail {
  side: 'PAR' | 'IMPAR';
  orientation: 'N' | 'S' | 'E' | 'O' | 'NE' | 'NO' | 'SE' | 'SO' | 'N/D';
  sunExposureNote: string;
  dataCompleteness: 'COMPLETO' | 'PARCIAL_ND';
}

export interface ScoreBreakdownItem {
  criterion: string;
  weight: number;
  rawScore: number; // 0..100
  weightedPoints: number;
  explanation: string;
}

export interface BlockSegment {
  id: string;
  zoneId: 'zona-a' | 'zona-b';
  streetName: string;
  fromStreet: string;
  toStreet: string;
  heightRange: string;
  neighborhood: string;
  microzone: string;
  coordinates: [number, number][]; // LineString [lng, lat][]
  centerPoint: [number, number];
  streetViewHeading: number;
  streetViewAvailable: boolean;
  sidewalks: {
    even: SidewalkDetail;
    odd: SidewalkDetail;
  };
  territorialScore: number; // 0..100
  scoreVersion: string;
  scoreConfidence: 'ALTA' | 'MEDIA' | 'BAJA' | 'INCOMPLETA';
  scoreBreakdown: ScoreBreakdownItem[];
  usdM2RefMin: number | null;
  usdM2RefMax: number | null;
  subteWalkMins: number | null;
  nearestTransport: string;
  activePropertyCount: number;
  missingDataFields: string[];
  isSynthetic: boolean;
}

export type LocationPrecision = 'EXACTA' | 'APROXIMADA_CUADRA' | 'SIN_CONFIRMAR';

export type PropertyTypology =
  | 'DEPTO_2AMB'
  | 'DEPTO_3AMB'
  | 'PH'
  | 'DEPTO_4AMB_EXCEPCION';

export type PropertyCondition =
  | 'A_REFACCIONAR'
  | 'EPOCA_ORIGINAL'
  | 'REGULAR'
  | 'BUENO'
  | 'ND';

export type UserTrackingStatus =
  | 'SIN_CLASIFICAR'
  | 'ME_INTERESA'
  | 'EN_OBSERVACION'
  | 'DESCARTAR';

export type SourceCategory =
  | 'PORTAL_INMOBILIARIO'
  | 'INMOBILIARIA_INDEPENDIENTE'
  | 'DUENO_DIRECTO_SITIO'
  | 'DUENO_DIRECTO_FB_GRUPO'
  | 'DUENO_DIRECTO_MARKETPLACE'
  | 'CARGA_MANUAL';

export type SourceAccessMode =
  | 'AUTOMATICO_AUTORIZADO'
  | 'ASISTIDO'
  | 'MANUAL'
  | 'PENDIENTE';

export interface PriceObservation {
  id: string;
  observedAt: string;
  priceUsd: number;
  note: string;
}

export interface PropertyListing {
  id: string;
  propertyId: string;
  sourceId: string;
  sourceName: string;
  sourceCategory: SourceCategory;
  accessMode: SourceAccessMode;
  agencyOrSeller: string;
  externalUrl: string;
  currentPriceUsd: number;
  previousPriceUsd: number | null;
  priceDropPct: number | null;
  activeState: 'ACTIVA' | 'NO_DETECTADA' | 'RETIRADA';
  firstObservedAt: string;
  lastObservedAt: string;
  observations: PriceObservation[];
  isSynthetic: boolean;
}

export interface ComparableReference {
  id: string;
  addressLabel: string;
  typology: PropertyTypology;
  areaM2: number;
  askingPriceUsd: number;
  usdPerM2: number;
  conditionState: PropertyCondition;
  distanceMeters: number;
}

export interface CanonicalProperty {
  id: string;
  blockId: string;
  zoneId: 'zona-a' | 'zona-b' | 'extra-zona';
  addressDisplay: string;
  locationPrecision: LocationPrecision;
  locationPrecisionNote: string;
  coordinates: [number, number]; // [lng, lat]
  streetViewHeading: number;
  streetViewAvailable: boolean;
  typology: PropertyTypology;
  rooms: number;
  totalAreaM2: number | null;
  coveredAreaM2: number | null;
  askingPriceUsdMin: number;
  askingPriceUsdMax: number;
  usdPerM2Asking: number | null;
  blockRefUsdPerM2: number | null;
  discountVsBlockPct: number | null; // negativo = por debajo del promedio pedido en cuadra
  conditionState: PropertyCondition;
  sidewalkSide: 'PAR' | 'IMPAR' | 'N/D';
  orientation: string;
  floorLabel: string;
  hasBalcony: boolean | null;
  expensesArs: number | null;
  daysOnMarket: number;
  hasRecentPriceDrop: boolean;
  isRepublished: boolean;
  isDirectOwnerDeclared: boolean;
  isApparentlyExclusiveInObservedSources: boolean;
  opportunityScore: number; // 0..100
  territorialScore: number; // 0..100 (heredado de su cuadra)
  scoreVersion: string;
  scoreConfidence: 'ALTA' | 'MEDIA' | 'BAJA';
  opportunityBreakdown: ScoreBreakdownItem[];
  missingDataFields: string[];
  listings: PropertyListing[];
  comparables: ComparableReference[];
  userStatus: UserTrackingStatus;
  discardReason: string;
  userNotes: string[];
  isSynthetic: boolean;
}

export interface GeocodeResult {
  query: string;
  matchedAddress: string;
  coordinates: [number, number];
  precision: LocationPrecision;
  source: 'FIXTURE_LOCAL_CABALLITO' | 'USIG_OFICIAL_GCBA';
  zoneId: 'zona-a' | 'zona-b' | 'extra-zona';
  streetViewUrl: string;
  streetViewAvailable: boolean;
  warning?: string;
}

export interface SourceRecord {
  id: string;
  name: string;
  baseUrl: string;
  category: SourceCategory;
  accessMode: SourceAccessMode;
  policyStatus: 'APTA' | 'PENDIENTE_REVISION' | 'RESTRINGIDA' | 'ERROR';
  robotsTxtAllowed: boolean | null;
  hasSitemap: boolean;
  hasStructuredData: boolean;
  activeListingsCount: number;
  lastCheckedAt: string;
  notes: string;
}

