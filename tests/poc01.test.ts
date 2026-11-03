import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../server/app';
import {
  buildGoogleStreetViewUrl,
  INITIAL_BLOCKS,
  INITIAL_PROPERTIES,
} from '../src/data/caballitoFixtures';

describe('Flipping Search Intelligence — IP-00 & IP-01 (POC-01) Automated Suite', () => {
  const app = createApp();

  it('IP-00: marca todos los registros de prueba con isSynthetic = true y expone aviso en /api/health', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.issuePacks).toContain('IP-00');
    expect(res.body.issuePacks).toContain('IP-01');
    expect(res.body.syntheticDataNotice).toContain('DATOS SINTÉTICOS DE PRUEBA');

    expect(INITIAL_BLOCKS.every((b) => b.isSynthetic === true)).toBe(true);
    expect(INITIAL_PROPERTIES.every((p) => p.isSynthetic === true)).toBe(true);
    expect(
      INITIAL_PROPERTIES.flatMap((p) => p.listings).every(
        (l) => l.isSynthetic === true
      )
    ).toBe(true);
  });

  it('IP-01 / POC-01: construye Zona A y deriva Zona B como diferencia sin superposición errónea', async () => {
    const res = await request(app).get('/api/zones');
    expect(res.status).toBe(200);
    expect(res.body.zones).toHaveLength(2);

    const zonaA = res.body.zones.find((z: any) => z.zoneType === 'ZONA_A');
    const zonaB = res.body.zones.find((z: any) => z.zoneType === 'ZONA_B');

    expect(zonaA).toBeDefined();
    expect(zonaB).toBeDefined();
    // Zona B debe contener exactamente el polígono de Zona A como hueco interior (diferencia geométrica)
    expect(zonaB.holes).toHaveLength(1);
    expect(zonaB.holes[0]).toEqual(zonaA.outerRing);
  });

  it('IP-01: permite alternar variantes y corregir geometría de Zona A actualizando automáticamente Zona B', async () => {
    const resVariant = await request(app)
      .post('/api/zones/variant')
      .send({ variant: 'RIVADAVIA_SUR_ESTRICTA' });

    expect(resVariant.status).toBe(200);
    expect(resVariant.body.activeVariant).toBe('RIVADAVIA_SUR_ESTRICTA');

    const zonaA = resVariant.body.zones.find((z: any) => z.zoneType === 'ZONA_A');
    const zonaB = resVariant.body.zones.find((z: any) => z.zoneType === 'ZONA_B');
    expect(zonaB.holes[0]).toEqual(zonaA.outerRing);
  });

  it('POC-01: incluye cuadras sin propiedades activas seleccionables y distingue datos incompletos (N/D)', async () => {
    const res = await request(app).get('/api/blocks');
    expect(res.status).toBe(200);
    expect(res.body.total).toBeGreaterThanOrEqual(8);
    expect(res.body.emptyBlocksCount).toBeGreaterThanOrEqual(2);

    // Verificar que existan cuadras con ambas veredas (PAR e IMPAR) y cuadras con datos N/D
    const goyenaBlock = res.body.blocks.find(
      (b: any) => b.id === 'BLK-ZA-GOY-0800'
    );
    expect(goyenaBlock.sidewalks.even.side).toBe('PAR');
    expect(goyenaBlock.sidewalks.odd.side).toBe('IMPAR');

    const miroIncompleteBlock = res.body.blocks.find(
      (b: any) => b.id === 'BLK-ZA-MIR-0400'
    );
    expect(miroIncompleteBlock.activePropertyCount).toBe(0);
    expect(miroIncompleteBlock.usdM2RefMin).toBeNull();
    expect(miroIncompleteBlock.scoreConfidence).toBe('INCOMPLETA');
  });

  it('IP-01 / POC-01: preserva relación N:1 (1 propiedad física con múltiples publicaciones) y no infiere venta por baja', async () => {
    const res = await request(app).get('/api/properties/PROP-CAB-001');
    expect(res.status).toBe(200);
    expect(res.body.property.listings).toHaveLength(2);
    expect(res.body.property.askingPriceUsdMin).toBe(118000);
    expect(res.body.property.askingPriceUsdMax).toBe(122000);

    // Verificar propiedad con aviso ausente (NO_DETECTADA != vendida)
    const resRiglos = await request(app).get('/api/properties/PROP-CAB-005');
    expect(resRiglos.status).toBe(200);
    const states = resRiglos.body.property.listings.map(
      (l: any) => l.activeState
    );
    expect(states).toContain('ACTIVA');
    expect(states).toContain('NO_DETECTADA');
  });

  it('POC-01: combina filtros principales y persiste estados Me interesa / En observación / Descartar', async () => {
    const resDrops = await request(app).get(
      '/api/properties?zoneId=zona-a&onlyPriceDrops=true'
    );
    expect(resDrops.status).toBe(200);
    expect(resDrops.body.properties.length).toBeGreaterThanOrEqual(2);
    expect(
      resDrops.body.properties.every(
        (p: any) => p.zoneId === 'zona-a' && p.hasRecentPriceDrop === true
      )
    ).toBe(true);

    // Cambiar estado a EN_OBSERVACION y agregar nota
    const patchRes = await request(app)
      .patch('/api/properties/PROP-CAB-003/status')
      .send({
        userStatus: 'ME_INTERESA',
        note: 'Visitar este sábado por la mañana.',
      });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.property.userStatus).toBe('ME_INTERESA');
    expect(patchRes.body.property.userNotes).toContain(
      'Visitar este sábado por la mañana.'
    );
  });

  it('POC-01: geocodifica diferenciando dirección exacta vs aproximada sin inventar altura y genera URL Street View válida', async () => {
    const exactRes = await request(app).get(
      '/api/geocode?q=' + encodeURIComponent('Pedro Goyena 842')
    );
    expect(exactRes.status).toBe(200);
    expect(exactRes.body.precision).toBe('EXACTA');
    expect(exactRes.body.streetViewUrl).toContain(
      'https://www.google.com/maps/@?api=1&map_action=pano'
    );

    const approxRes = await request(app).get(
      '/api/geocode?q=' + encodeURIComponent('Valle al 700')
    );
    expect(approxRes.status).toBe(200);
    expect(approxRes.body.precision).toBe('APROXIMADA_CUADRA');
    expect(approxRes.body.warning).toContain('Ubicación aproximada');

    const url = buildGoogleStreetViewUrl([-58.44415, -34.62692], 15);
    expect(url).toBe(
      'https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=-34.626920,-58.444150&heading=15&pitch=5&fov=85'
    );
  });

  it('IP-04 / IP-05 / IP-07: importa publicación real desde texto, la etiqueta con isSynthetic=false y deduplica N:1 si coincide la unidad física', async () => {
    // 1. Importar nueva oportunidad real en Pedro Goyena 842 (misma unidad que PROP-CAB-001: 3 amb, ~74m²)
    const dupRes = await request(app)
      .post('/api/listings/import')
      .send({
        address: 'Av. Pedro Goyena 842',
        rawText:
          'Dueño directo vende 3 ambientes a refaccionar en Pedro Goyena 842, 74 m2, USD 114.000',
        sourceName: 'Grupo FB Caballito Directo',
        sourceCategory: 'DUENO_DIRECTO_FB_GRUPO',
      });

    expect(dupRes.status).toBe(200);
    expect(dupRes.body.deduplicated).toBe(true);
    expect(dupRes.body.property.id).toBe('PROP-CAB-001');
    expect(dupRes.body.property.askingPriceUsdMin).toBe(114000);
    expect(dupRes.body.property.listings.length).toBeGreaterThanOrEqual(3);

    // 2. Importar unidad nueva real en otra dirección (no duplicada)
    const newRes = await request(app)
      .post('/api/listings/import')
      .send({
        address: 'Av. Asamblea 920',
        rawText: 'PH 3 ambientes a reciclar total, 82 m2, USD 88.000',
        sourceName: 'Inmobiliaria Parque Chacabuco',
        sourceCategory: 'INMOBILIARIA_INDEPENDIENTE',
      });

    expect(newRes.status).toBe(201);
    expect(newRes.body.deduplicated).toBe(false);
    expect(newRes.body.property.isSynthetic).toBe(false);
    expect(newRes.body.property.askingPriceUsdMin).toBe(88000);
  });

  it('IP-03: inspecciona y registra fuentes por URL distinguiendo acceso automático vs asistido (Facebook)', async () => {
    const fbRes = await request(app)
      .post('/api/sources/inspect')
      .send({
        url: 'https://www.facebook.com/groups/duenodirectocaballito',
        name: 'FB Dueño Directo Caballito',
      });

    expect(fbRes.status).toBe(201);
    expect(fbRes.body.source.accessMode).toBe('ASISTIDO');
    expect(fbRes.body.source.policyStatus).toBe('RESTRINGIDA');
  });
});
