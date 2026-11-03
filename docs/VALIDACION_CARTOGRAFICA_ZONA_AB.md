# Validación Cartográfica GIS — Zona A y Zona B (Caballito / Parque Chacabuco)

**Estado:** Verificado contra el Normalizador Oficial USIG del Gobierno de la Ciudad de Buenos Aires (`servicios.usig.buenosaires.gob.ar`) en el marco de `IP-01` / `POC-01`.

---

## 1. Hallazgos Cartográficos Críticos (Continuidad de Calles)

El Documento Maestro V0.4 establece como requisito obligatorio validar la continuidad real de las calles antes de fijar las geometrías definitivas. La auditoría sobre el callejero oficial USIG CABA reveló **cuatro cambios de nomenclatura y discontinuidades ferroviarias** que deben contemplarse explícitamente:

### A. Perímetro de Zona A (Prioritaria)
Referencias nominales del brief: **Aranguren (N)**, **Av. Eva Perón (S)**, **Emilio Mitre (E)**, **Malvinas Argentinas (O)**.

1. **Cruce del FFCC Sarmiento y Av. Rivadavia (Eje Este y Eje Oeste):**
   - **Emilio Mitre** nace en **Av. Rivadavia** (`[-58.444354, -34.621727]`) hacia el sur hasta **Av. Eva Perón** (`[-58.442423, -34.631192]`). No cruza las vías del FFCC Sarmiento con ese nombre: su continuación exacta hacia el norte hasta **Dr. Juan Felipe Aranguren** es el eje **Federico García Lorca / Dr. Nicolás Repetto** (intersección Aranguren y Dr. Nicolás Repetto en `[-58.445231, -34.615623]`).
   - **Malvinas Argentinas** nace en **Av. Rivadavia** (`[-58.451988, -34.624835]`) hacia el sur hasta **Av. Eva Perón** (`[-58.447298, -34.634764]`). Al cruzar Av. Rivadavia y las vías hacia el norte hasta **Dr. Juan F. Aranguren**, su continuación en eje es **Nicasio Oroño** (`[-58.452009, -34.618354]`) / **Fragata Pres. Sarmiento** (`[-58.450785, -34.617876]`).
2. **Dos variantes parametrizables incluidas en POC-01:**
   - **Variante 1 (Completa Aranguren → Eva Perón):** Une `Aranguren` al norte con `Av. Eva Perón` al sur utilizando las continuaciones norte (`Nicasio Oroño` al oeste y `Dr. Nicolás Repetto / F. García Lorca` al este) para cruzar Av. Rivadavia.
   - **Variante 2 (Estricta Sur de Rivadavia → Eva Perón):** Restringe Zona A al polígono donde existen nominalmente `Malvinas Argentinas` y `Emilio Mitre` (`Av. Rivadavia` al norte hasta `Av. Eva Perón` al sur), dejando la franja `Rivadavia → Aranguren` dentro de Zona B.
   - *La interfaz de POC-01 permite alternar en vivo entre ambas variantes y editar sus vértices para la decisión humana del Día 1.*

---

### B. Perímetro General y Zona B (Derivada como Diferencia: `Perímetro General − Zona A`)
Referencias nominales del brief: **Av. Gaona (N)**, **Acoyte / José María Moreno (E)**, **Donato Álvarez (O)**, **dos cuadras al sur de Asamblea (S)**.

1. **Eje Oeste (`Tte. Gral. Donato Álvarez` → `Curapaligue`):**
   - **Donato Álvarez** corre desde **Av. Gaona** (`[-58.459449, -34.613884]`) hasta **Av. Rivadavia** (`[-58.454032, -34.625629]`), donde cambia su nombre a **Curapaligue** hacia el sur, cruzando **Av. Eva Perón** (`[-58.447505, -34.634916]`), **Av. Asamblea** (`[-58.445878, -34.636654]`) y **Saraza** (`[-58.443796, -34.640735]`).
2. **Vértice Noreste (`Av. Gaona` → `Av. Díaz Vélez` → `Av. Acoyte`):**
   - **Av. Gaona** nace en **Av. Díaz Vélez** (`[-58.445412, -34.607789]`, monumento al Cid Campeador); **Av. Acoyte** llega hasta **Av. Díaz Vélez** (`[-58.440122, -34.608797]`). El cierre norte-este sigue el conector real `Gaona → Díaz Vélez → Acoyte`.
3. **Eje Este (`Av. Acoyte` → `Av. José María Moreno`):**
   - En **Av. Rivadavia** (`[-58.436460, -34.618299]`), **Av. Acoyte** se convierte hacia el sur en **Av. José María Moreno**, cruzando **Av. Pedro Goyena** (`[-58.434309, -34.625866]`), **Av. Directorio** (`[-58.433821, -34.628018]`) y **Av. Asamblea** (`[-58.432741, -34.634017]`).
4. **Borde Sur ("dos cuadras al sur de Asamblea"):**
   - 1.ª cuadra al sur de Av. Asamblea: **Santander** (`[-58.432555, -34.634923]` en J. M. Moreno hasta `[-58.445316, -34.637258]` en Curapaligue).
   - 2.ª cuadra continua al sur de Av. Asamblea: **Saraza** (`[-58.431887, -34.638119]` en J. M. Moreno, `[-58.437460, -34.639142]` en Emilio Mitre, `[-58.443796, -34.640735]` en Curapaligue), con **Av. Castañares** como diagonal intermedia.
5. **Exclusión geométrica sin superposición:**
   - En `POC-01`, **Zona B** se construye como polígono con hueco interior (`Polygon with interior ring = Zona A`), garantizando matemáticamente **superposición cero** entre Zona A y Zona B.

---

## 2. Tabla de Vértices Oficiales USIG CABA

| Nodo | Intersección Real Normalizada (USIG CABA) | Longitud (`X`) | Latitud (`Y`) | Rol Cartográfico |
| :--- | :--- | :---: | :---: | :--- |
| `ZA-NO` | Dr. Juan F. Aranguren y Nicasio Oroño | `-58.452009` | `-34.618354` | Esquina NO Zona A (Variante 1) |
| `ZA-NE` | Dr. Juan F. Aranguren y Dr. Nicolás Repetto | `-58.445231` | `-34.615623` | Esquina NE Zona A (Variante 1) |
| `ZA-RIV-O` | Av. Rivadavia y Malvinas Argentinas | `-58.451988` | `-34.624835` | Quiebre Oeste sobre Av. Rivadavia |
| `ZA-RIV-E` | Av. Rivadavia y Emilio Mitre | `-58.444354` | `-34.621727` | Quiebre Este sobre Av. Rivadavia |
| `ZA-SE` | Av. Eva Perón y Emilio Mitre | `-58.442423` | `-34.631192` | Esquina SE Zona A |
| `ZA-SO` | Av. Eva Perón y Malvinas Argentinas | `-58.447298` | `-34.634764` | Esquina SO Zona A |
| `ZB-NO` | Av. Gaona y Tte. Gral. Donato Álvarez | `-58.459449` | `-34.613884` | Esquina NO Perímetro General |
| `ZB-CID` | Av. Gaona y Av. Díaz Vélez (Cid Campeador) | `-58.445412` | `-34.607789` | Vértice Norte Central |
| `ZB-NE` | Av. Díaz Vélez y Av. Acoyte | `-58.440122` | `-34.608797` | Esquina NE Perímetro General |
| `ZB-ACO-RIV` | Av. Rivadavia y Av. Acoyte / J. M. Moreno | `-58.436460` | `-34.618299` | Transición Acoyte → J. M. Moreno |
| `ZB-SE` | Saraza y Av. José María Moreno | `-58.431887` | `-34.638119` | Esquina SE (2 cuadras sur de Asamblea) |
| `ZB-SO` | Saraza y Curapaligue | `-58.443796` | `-34.640735` | Esquina SO (2 cuadras sur de Asamblea) |
| `ZB-DON-RIV` | Av. Rivadavia y Donato Álvarez / Curapaligue | `-58.454032` | `-34.625629` | Transición Donato Álvarez → Curapaligue |
