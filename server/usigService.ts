import {
  LocationPrecision,
  PropertyCondition,
  PropertyTypology,
  ZoneDefinition,
} from '../src/types/domain';

export interface TransportStation {
  name: string;
  line: string;
  coordinates: [number, number]; // [lng, lat]
}

// Estaciones reales de Subte A, Subte E y FFCC Sarmiento en Caballito / Parque Chacabuco
export const CABALLITO_STATIONS: TransportStation[] = [
  { name: 'Río de Janeiro', line: 'Subte A', coordinates: [-58.4295, -34.6152] },
  { name: 'Acoyte', line: 'Subte A', coordinates: [-58.43646, -34.6183] },
  { name: 'Primera Junta', line: 'Subte A', coordinates: [-58.4412, -34.6204] },
  { name: 'Puan', line: 'Subte A', coordinates: [-58.4484, -34.6235] },
  { name: 'Carabobo', line: 'Subte A', coordinates: [-58.4567, -34.6266] },
  { name: 'José María Moreno', line: 'Subte E', coordinates: [-58.4338, -34.628] },
  { name: 'Emilio Mitre', line: 'Subte E', coordinates: [-58.4426, -34.631] },
  { name: 'Medalla Milagrosa', line: 'Subte E', coordinates: [-58.4503, -34.6363] },
  { name: 'Caballito', line: 'FFCC Sarmiento', coordinates: [-58.4428, -34.6189] },
];

export function haversineMeters(
  a: [number, number],
  b: [number, number]
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat +
    Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * sinLng * sinLng;
  return Math.round(2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)));
}

export function computeNearestTransport(coords: [number, number]): {
  walkMins: number;
  summary: string;
  distanceMeters: number;
} {
  let best = CABALLITO_STATIONS[0];
  let minMeters = Infinity;

  for (const st of CABALLITO_STATIONS) {
    const d = haversineMeters(coords, st.coordinates);
    if (d < minMeters) {
      minMeters = d;
      best = st;
    }
  }

  // Factor de red peatonal urbana (1.25x distancia euclidiana, velocidad 78m/min)
  const networkMeters = Math.round(minMeters * 1.22);
  const walkMins = Math.max(1, Math.round(networkMeters / 78));
  return {
    walkMins,
    distanceMeters: networkMeters,
    summary: `${best.line} (${best.name}) a ~${networkMeters}m caminables`,
  };
}

// Algoritmo Ray-Casting para determinar si un punto cae dentro de un polígono GeoJSON
export function isPointInRing(
  point: [number, number],
  ring: [number, number][]
): boolean {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function classifyPointZone(
  point: [number, number],
  zones: ZoneDefinition[]
): 'zona-a' | 'zona-b' | 'extra-zona' {
  const zonaA = zones.find((z) => z.zoneType === 'ZONA_A');
  if (zonaA && isPointInRing(point, zonaA.outerRing)) {
    return 'zona-a';
  }
  const zonaB = zones.find((z) => z.zoneType === 'ZONA_B');
  if (zonaB && isPointInRing(point, zonaB.outerRing)) {
    return 'zona-b';
  }
  return 'extra-zona';
}

export interface UsigLookupResult {
  normalizedAddress: string;
  coordinates: [number, number];
  precision: LocationPrecision;
  neighborhood?: string;
}

export async function geocodeWithUsigLive(
  rawAddress: string
): Promise<UsigLookupResult | null> {
  const clean = rawAddress.includes('CABA')
    ? rawAddress
    : `${rawAddress}, CABA`;
  const url = `https://servicios.usig.buenosaires.gob.ar/normalizar/?direccion=${encodeURIComponent(
    clean
  )}&geocodificar=TRUE`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4500);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);

    if (!res.ok) return null;
    const data = (await res.json()) as {
      direccionesNormalizadas?: Array<{
        direccion?: string;
        tipo?: string;
        coordenadas?: { x?: string | number; y?: string | number };
      }>;
    };

    const candidates = data.direccionesNormalizadas ?? [];
    const withCoords = candidates.find(
      (c) => c.coordenadas?.x !== undefined && c.coordenadas?.y !== undefined
    );
    if (!withCoords || !withCoords.coordenadas) return null;

    const lng = Number(withCoords.coordenadas.x);
    const lat = Number(withCoords.coordenadas.y);
    if (Number.isNaN(lng) || Number.isNaN(lat)) return null;

    // Si tiene número de puerta y no es "al 700" o calle sola, es EXACTA
    const hasDoorNumber = /\b\d{2,5}\b/.test(withCoords.direccion ?? '');
    const isApproxPattern = /\bal\s+\d+/i.test(rawAddress);

    return {
      normalizedAddress: withCoords.direccion ?? rawAddress,
      coordinates: [lng, lat],
      precision:
        hasDoorNumber && !isApproxPattern ? 'EXACTA' : 'APROXIMADA_CUADRA',
    };
  } catch {
    return null;
  }
}

export interface ParsedListingCandidate {
  addressGuess: string;
  priceUsd: number | null;
  rooms: number;
  typology: PropertyTypology;
  totalAreaM2: number | null;
  coveredAreaM2: number | null;
  conditionState: PropertyCondition;
  isDirectOwnerDeclared: boolean;
}

export function parseFreeTextListing(text: string): ParsedListingCandidate {
  const normalized = text.replace(/\s+/g, ' ').trim();

  // Extraer precio USD (ej: USD 95.000, U$S 110000, $ 85.000 USD)
  let priceUsd: number | null = null;
  const priceMatch =
    normalized.match(
      /(?:USD|U\$S|U\$D|US\$|D[OÓ]LARES)\s*([0-9]{2,3}(?:[.,][0-9]{3})+|[0-9]{5,6})/i
    ) ??
    normalized.match(
      /([0-9]{2,3}(?:[.,][0-9]{3})+)\s*(?:USD|U\$S|U\$D|D[OÓ]LARES)/i
    );
  if (priceMatch?.[1]) {
    const cleanNum = Number(priceMatch[1].replace(/[.,]/g, ''));
    if (!Number.isNaN(cleanNum) && cleanNum >= 20000 && cleanNum <= 1500000) {
      priceUsd = cleanNum;
    }
  }

  // Extraer m² (ej: 65 m2, 72m²)
  let totalAreaM2: number | null = null;
  const areaMatch = normalized.match(/(\d{2,3})\s*(?:m2|m²|metros|mts)/i);
  if (areaMatch?.[1]) {
    totalAreaM2 = Number(areaMatch[1]);
  }

  // Extraer ambientes y tipología
  let rooms = 3;
  const roomsMatch = normalized.match(/([1-5])\s*(?:ambientes|amb\b)/i);
  if (roomsMatch?.[1]) {
    rooms = Number(roomsMatch[1]);
  }

  let typology: PropertyTypology = 'DEPTO_3AMB';
  if (/\bPH\b/i.test(normalized)) {
    typology = 'PH';
  } else if (rooms <= 2) {
    typology = 'DEPTO_2AMB';
    rooms = 2;
  } else if (rooms === 3) {
    typology = 'DEPTO_3AMB';
  } else {
    typology = 'DEPTO_4AMB_EXCEPCION';
  }

  // Detectar estado físico
  let conditionState: PropertyCondition = 'EPOCA_ORIGINAL';
  if (
    /refaccionar|reciclar|demoler|sucesi[oó]n|deteriorad|a nuevo total/i.test(
      normalized
    )
  ) {
    conditionState = 'A_REFACCIONAR';
  } else if (/época|epoca|original|antiguo/i.test(normalized)) {
    conditionState = 'EPOCA_ORIGINAL';
  } else if (/regular|habitable/i.test(normalized)) {
    conditionState = 'REGULAR';
  }

  const isDirectOwnerDeclared =
    /due[ñn]o directo|sin comisi[oó]n|trato directo|particular vende/i.test(
      normalized
    );

  return {
    addressGuess: '',
    priceUsd,
    rooms,
    typology,
    totalAreaM2,
    coveredAreaM2: totalAreaM2 ? Math.round(totalAreaM2 * 0.92) : null,
    conditionState,
    isDirectOwnerDeclared,
  };
}

export interface UrlExtractedDraft {
  url: string;
  title: string;
  description: string;
  addressGuess: string;
  priceUsd: number | null;
  totalAreaM2: number | null;
  rooms: number;
  typology: PropertyTypology;
  conditionState: PropertyCondition;
  sourceName: string;
}

export async function extractListingFromPublicUrl(
  targetUrl: string
): Promise<UrlExtractedDraft> {
  const parsedUrl = new URL(targetUrl);
  const host = parsedUrl.hostname.replace(/^www\./, '');

  // Intentar deducir dirección/barrio desde el slug de la URL por si el sitio tiene protección antibot
  const slugWords = decodeURIComponent(parsedUrl.pathname)
    .replace(/[-_/]+/g, ' ')
    .trim();

  let html = '';
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(targetUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'es-AR,es;q=0.9,en;q=0.8',
      },
    });
    clearTimeout(timer);
    if (res.ok) {
      html = await res.text();
    }
  } catch {
    // Fallback al análisis del slug de la URL si el sitio bloquea requests directos
  }

  const ogTitle =
    html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1] ??
    html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] ??
    slugWords;

  const ogDesc =
    html.match(
      /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i
    )?.[1] ??
    html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)?.[1] ??
    '';

  const combinedText = `${ogTitle} ${ogDesc} ${slugWords}`;
  const parsed = parseFreeTextListing(combinedText);

  // Intentar detectar calle y altura de CABA en el título/slug (ej: "Pedro Goyena 842", "Puan 400", "Alberdi 1100")
  const streetMatch = combinedText.match(
    /\b((?:Av\.?\s+|Avenida\s+)?[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+){0,2}\s+(?:al\s+)?\d{2,4})\b/
  );

  return {
    url: targetUrl,
    title: ogTitle.trim(),
    description: ogDesc.trim(),
    addressGuess: streetMatch?.[1] ?? '',
    priceUsd: parsed.priceUsd,
    totalAreaM2: parsed.totalAreaM2,
    rooms: parsed.rooms,
    typology: parsed.typology,
    conditionState: parsed.conditionState,
    sourceName: host,
  };
}

export interface LiveScrapedListing {
  externalId: string;
  title: string;
  url: string;
  streetAddress: string;
  locality: string;
  coordinates: [number, number]; // [lng, lat]
  rooms: number;
  totalAreaM2: number;
  priceUsd: number;
  typology: PropertyTypology;
  conditionState: PropertyCondition;
  agencyName: string;
  sourceUrl: string;
}

export async function fetchLiveCaballitoJsonLdCatalog(
  maxPages = 5
): Promise<LiveScrapedListing[]> {
  const results: LiveScrapedListing[] = [];
  const seenUrls = new Set<string>();

  for (let page = 1; page <= maxPages; page++) {
    const feedUrl = `https://lepore.com.ar/propiedades?location%5B%5D=Argentina%2CCapital+Federal%2CCaballito&location%5B%5D=Argentina%2CCapital+Federal%2CParque+Chacabuco&operation%5B%5D=1&page=${page}`;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(feedUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'es-AR,es;q=0.9',
        },
      });
      clearTimeout(timer);
      if (!res.ok) continue;
      const html = await res.text();

      const scriptRegex =
        /<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi;
      let match: RegExpExecArray | null;
      while ((match = scriptRegex.exec(html)) !== null) {
        try {
          const data = JSON.parse(match[1].trim());
          if (data?.['@type'] !== 'RealEstateListing') continue;

          const url = String(data.url ?? '').trim();
          if (!url || seenUrls.has(url)) continue;

          const about = data.about ?? {};
          const addr = about.address ?? {};
          const geo = about.geo ?? {};
          const offers = data.offers ?? {};

          const price = Number(offers.price ?? 0);
          const currency = String(offers.priceCurrency ?? 'USD');
          if (currency !== 'USD' || price < 35000 || price > 600000) continue;

          const rooms = Number(about.numberOfRooms ?? 0);
          if (rooms < 2 || rooms > 4) continue;

          const area = Math.round(Number(about.floorSize?.value ?? 0));
          if (area < 28 || area > 240) continue;

          const lat = Number(geo.latitude);
          const lng = Number(geo.longitude);
          if (
            Number.isNaN(lat) ||
            Number.isNaN(lng) ||
            lat > -34.58 ||
            lat < -34.67 ||
            lng < -58.52 ||
            lng > -58.38
          ) {
            continue;
          }

          const nameStr = String(data.name ?? 'Propiedad en Caballito').trim();
          const streetAddress = String(addr.streetAddress ?? '').replace(/\s+/g, ' ').trim();
          const locality = String(addr.addressLocality ?? 'Caballito').trim();
          if (!streetAddress) continue;

          let typology: PropertyTypology = 'DEPTO_3AMB';
          if (/\bph\b/i.test(nameStr) || /\bph\b/i.test(url)) {
            typology = 'PH';
          } else if (rooms === 2) {
            typology = 'DEPTO_2AMB';
          } else if (rooms === 3) {
            typology = 'DEPTO_3AMB';
          } else {
            typology = 'DEPTO_4AMB_EXCEPCION';
          }

          const usdM2 = Math.round(price / area);
          let conditionState: PropertyCondition = 'REGULAR';
          if (
            /refaccionar|reciclar|oportunidad|antiguo/i.test(nameStr) ||
            usdM2 <= 1650
          ) {
            conditionState = 'A_REFACCIONAR';
          } else if (usdM2 <= 1980) {
            conditionState = 'EPOCA_ORIGINAL';
          }

          seenUrls.add(url);
          results.push({
            externalId: url.split('--').pop() ?? String(Date.now()),
            title: nameStr,
            url,
            streetAddress,
            locality,
            coordinates: [lng, lat],
            rooms,
            totalAreaM2: area,
            priceUsd: price,
            typology,
            conditionState,
            agencyName: 'Lepore Propiedades Caballito (Catálogo JSON-LD)',
            sourceUrl: 'https://lepore.com.ar/propiedades',
          });
        } catch {
          // Ignore malformed JSON-LD block
        }
      }
    } catch {
      // Continue with next page
    }
  }

  return results;
}


