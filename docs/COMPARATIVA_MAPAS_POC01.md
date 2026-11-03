# Comparativa Técnica, Legal y de Costos: MapLibre/OSM + USIG vs. Google Maps Platform (`POC-01`)

Documento de evaluación requerido por `05_POC_01_Mapa.md` (Punto 6) y `03_Arquitectura_y_Plan_Tecnico.docx` (Sección 5) para decidir el proveedor definitivo tras el protocolo de revisión de 2 días.

---

## 1. Matriz Comparativa para Flipping Search Intelligence (CABA)

| Dimensión | Opción Base Implementada: **MapLibre GL JS + OpenStreetMap + USIG CABA** | Alternativa Evaluada: **Google Maps Platform (JS API + Geocoding + Street View Static/JS)** | Recomendación para el MVP |
| :--- | :--- | :--- | :--- |
| **Costo mensual estimado (Uso intensivo de 1–5 analistas, ~15.000 cargas de mapa/mes y 5.000 geocodificaciones)** | **USD 0 / mes** (Tiles vectoriales/raster libres CARTO/OSM + API pública gratuita de USIG GCBA para CABA). | Cubierto por el crédito inicial de USD 200/mes de Google Cloud, pero al escalar: Dynamic Maps (~USD 7 / 1.000 cargas), Geocoding (~USD 5 / 1.000 req), Street View Dynamic (~USD 14 / 1.000 panos). Requiere tarjeta de crédito y alertas de facturación. | **MapLibre + USIG CABA** para mapa base, grilla y geocodificación. |
| **Licencia y Almacenamiento en PostGIS** | **Permitido (ODbL / Datos Abiertos GCBA):** Permite almacenar geometrías de cuadras (`blocks`), polígonos A/B y coordenadas normalizadas en PostgreSQL/PostGIS de forma permanente. | **Restringido por ToS de Google Maps:** Prohibido almacenar (`cache/store`) coordenadas devueltas por Google Geocoding API en una base de datos propia por más de 30 días o usarlas fuera de un mapa de Google. | **Crítico a favor de OSM + USIG:** El motor territorial PostGIS necesita persistir geometrías e historial sin violar términos de servicio. |
| **Precisión en Caballito / Parque Chacabuco** | **Muy alta:** El normalizador oficial **USIG CABA** conoce alturas exactas por cuadra par/impar, barrios oficiales y cruces de CABA sin costo. | **Muy alta**, aunque ocasionalmente interpola numeraciones en pasajes de Caballito. | **USIG CABA** como geocodificador primario en CABA; Nominatim como respaldo fuera de CABA. |
| **Renderizado de Grilla de Cuadras, Veredas y Capas Custom** | **Nativo WebGL (GeoJSON / Vector Tiles):** Control total de capas de polígonos con huecos (`Zona B − Zona A`), líneas con offset por vereda par/impar y coloreo dinámico por score sin límites de llamadas. | Soportado vía `Data Layer` / `WebGLOverlayView`, pero acopla el código del frontend al SDK propietario de Google. | **MapLibre GL JS** mantiene el principio de independencia de proveedor exigido en el Anexo V0.2. |
| **Street View (Inspección visual de fachada y entorno)** | No posee imágenes de fachada propias, pero permite abrir **enlaces profundos oficiales de Google Street View** (`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=lat,lng`) en pestaña/ventana dedicada sin costo de API ni clave obligatoria. | Permite incrustar el visor interactivo `StreetViewPanorama` dentro del panel lateral (consume cuota de Dynamic Street View API: USD 14 por cada 1.000 panoramas instanciados). | **Híbrido en MVP:** Mapa principal en MapLibre + apertura instantánea de Google Street View por URL oficial verificada (costo USD 0). Opcional activar embed SDK con API Key si se desea en Fase 2. |
| **Cálculo Solar / Orientación de Fachada** | **Cálculo geométrico en PostGIS/Turf** a partir del azimut del tramo de calle (`blocks`): determina orientación de vereda par e impar (N, NE, NO, S, SE, SO) de forma inmediata y explicable. | **Google Solar API:** Orientada a techos (paneles solares), **NO calcula asoleamiento por piso sobre fachada vertical** ni obstrucciones de medianeras en departamentos de CABA. | **Cálculo de azimut por vereda en PostGIS** advirtiendo en la UI que orientación de cuadra ≠ luz real de unidad (depende de piso, contrafrente y pulmón). |

---

## 2. Conclusión Propuesta para la Decisión de Fase 0 / POC-01

1. **Adoptar arquitectura híbrida desacoplada:**
   - **Cartografía y Capas WebGL:** `MapLibre GL JS` con tiles de OpenStreetMap / CARTO Voyager (sin lock-in y con soporte nativo para edición de polígonos y grilla de cuadras).
   - **Geocodificación y Callejero en CABA:** `USIG Normalizador GCBA` + `PostGIS` (permite guardar coordenadas y tramos legalmente en base propia).
   - **Street View:** Enlace profundo directo a Google Maps Street View parametrizado por coordenadas y azimut (sin consumo de cuota API), degradando con aviso explícito cuando la propiedad sólo tiene dirección aproximada.
