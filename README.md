# Flipping Search Intelligence — Monorepo (`IP-00` + `IP-01` / `POC-01`)

Implementación ejecutable y verificable de **IP-00 (Base reproducible y datos de prueba)** e **IP-01 / POC-01 (Geografía, Mapa de Caballito, Grilla de Cuadras/Veredas, Fichas y Street View)**, respetando de forma estricta las decisiones y restricciones del **Documento Maestro V0.4**.

> [!IMPORTANT]
> **Etiquetado de Datos Sintéticos (`isSynthetic = true`):** Todos los inmuebles, publicaciones, precios e historiales cargados en esta POC son **datos sintéticos de prueba** identificados visualmente y por API. Los polígonos y cruces de calles de Caballito / Parque Chacabuco están verificados contra el normalizador oficial **USIG CABA** (`servicios.usig.buenosaires.gob.ar`).

---

## 1. Ejecución Rápida en Entorno Local

### Requisitos
- **Node.js 20+** (verificado con Node `v24.17.0` y npm `11.13.0`)
- **Docker Compose** *(opcional: el sistema incluye `docker-compose.yml` + migraciones PostGIS en `migrations/001_init_postgis.sql`, pero también levanta de inmediato sin Docker usando el motor geoespacial local en memoria con las mismas fixtures)*.

### Comandos
```bash
# 1. Instalar dependencias
npm install

# 2. Ejecutar suite de pruebas automáticas (IP-00 + IP-01 / POC-01)
npm test

# 3. Verificar tipado TypeScript y build de producción
npm run typecheck
npm run build

# 4. Levantar aplicación interactiva (Frontend MapLibre + API REST en puerto 5173)
npm run dev
```

*(Opcional con Docker PostGIS instalado)*:
```bash
cp .env.example .env
docker compose up -d
```

---

## 2. Alcance Implementado (`IP-00` + `IP-01` + `POC-01`)

1. **Geometría de Zona A y Zona B sin superposición (`src/data/caballitoFixtures.ts` y `docs/VALIDACION_CARTOGRAFICA_ZONA_AB.md`):**
   - **Zona A (Prioritaria):** Polígono validado con dos variantes parametrizables en vivo:
     - *Variante 1 (Completa Aranguren → Eva Perón):* Empalma `Emilio Mitre` con su continuación norte `Dr. Nicolás Repetto / F. García Lorca` y `Malvinas Argentinas` con `Nicasio Oroño` al cruzar Av. Rivadavia y las vías del FFCC Sarmiento hasta `Dr. Juan Felipe Aranguren`.
     - *Variante 2 (Estricta Sur de Rivadavia → Eva Perón):* Delimitada entre `Av. Rivadavia`, `Emilio Mitre`, `Av. Eva Perón` y `Malvinas Argentinas`.
   - **Zona B (Secundaria):** Calculada matemáticamente como **diferencia geométrica (`Perímetro General − Zona A`)** mediante anillo interior hueco (`holes: [zonaA.outerRing]`), garantizando **superposición cero**. Contempla las transiciones reales de `Donato Álvarez → Curapaligue`, `Acoyte → José María Moreno`, el cierre norte `Gaona → Díaz Vélez → Acoyte` y el borde sur en `Saraza` (2.ª cuadra paralela al sur de `Av. Asamblea`).
   - **Editor/Corrector en vivo:** Permite alternar variantes y desplazar el borde norte desde la interfaz del mapa.

2. **Grilla de Tramos de Cuadra y Veredas (`blocks`):**
   - Incluye cuadras con propiedades y **cuadras sin propiedades activas** (`BLK-ZA-GOY-0900`, `BLK-ZA-ALB-0900`, `BLK-ZA-MIR-0400`, `BLK-ZB-ASM-0800`), todas seleccionables en el mapa y desde la barra inferior.
   - Diferencia **Vereda Par** y **Vereda Impar**, su orientación estimada por azimut (`N`, `S`, `E`, `O`, `NO`, `SE`) y distingue explícitamente datos faltantes (`N/D` en `Miró 401–600`).

3. **Ficha Consolidada Multifuente (`1 Propiedad Física : N Publicaciones`):**
   - Separa **Propiedad Física** de sus **Publicaciones** (`Zonaprop`, `Argenprop`, `Inmobiliaria Independiente`, `Dueño Directo Grupo FB`, `Mercado Libre`) y conserva el historial de observaciones.
   - Una publicación ausente se etiqueta `NO_DETECTADA` (`PROP-CAB-005` en Riglos 340), nunca como venta cerrada.
   - No inventa números de puerta cuando el aviso sólo informa la cuadra (`PROP-CAB-002` en `"Valle al 700"`, marcada como `APROXIMADA_CUADRA`).

4. **Street View y Comparativa de Proveedores (`docs/COMPARATIVA_MAPAS_POC01.md`):**
   - Apertura de **Google Street View** parametrizada por coordenadas y orientación (`heading`) sin requerir clave de API facturable, informando explícitamente cuando el tramo no tiene cobertura confirmada (`Miró 401–600`) o cuando la ubicación es aproximada.
   - Tabla comparativa de costos, licencias de persistencia en PostGIS y capacidades entre **MapLibre GL JS + OSM + USIG CABA** y **Google Maps Platform**.
