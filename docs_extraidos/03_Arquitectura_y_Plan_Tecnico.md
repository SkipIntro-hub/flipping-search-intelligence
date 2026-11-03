Arquitectura y plan técnico

Versión 1.0 · 03/11/2026 · Estado: especificación para validación, no software implementado

1. Decisiones técnicas propuestas (no cerradas)

Frontend: React + TypeScript; mapa MapLibre GL JS como opción base, evaluar Google Maps Platform mediante POC con costos y términos.

Backend: API Node.js/TypeScript; PostgreSQL + PostGIS; tareas periódicas con n8n o worker con cola; almacenamiento de metadatos y enlaces, no redistribuir imágenes sin derechos.

GitHub como repositorio; entorno local reproducible con Docker Compose; despliegue Vercel + base administrada o VPS según costo y conectividad.

2. Arquitectura lógica

UI desktop/móvil → API autenticada → dominio inmuebles/publicaciones/fuentes → PostGIS → motor de ingestión → conectores aprobados.

Procesos: descubrimiento de fuentes, extracción, normalización, geocodificación, detección de duplicados, cálculo de señales, eventos de cambios y notificaciones.

No acoplar la lógica de negocio a Antigravity, Gemini, Codex o un proveedor de mapas.

3. Esquema mínimo

zones(id,name,geom,priority); blocks(id,geom,side,score,score_version); properties(id,geom,location_precision,type,rooms,area,status); listings(id,property_id,source_id,external_key,url,active_state); sources(id,type,base_url,access_mode,policy_status,last_checked_at); observations(id,listing_id,observed_at,price,currency,raw_ref); matches(id,listing_a,listing_b,confidence,decision); notes(id,property_id,text,created_at); events(id,listing_id,type,occurred_at).

Indices espaciales GiST; claves externas y constraints; versionado de reglas y puntuaciones; datos personales mínimos.

4. Contratos de API iniciales

GET /zones, GET /blocks?bbox=, GET /properties?bbox=&filters=, GET /properties/:id, PATCH /properties/:id/status, POST /extra-zone, POST /sources/inspect, POST /sources, GET /sources/:id/health, POST /listings/import.

Respuesta de propiedad incluye location_precision, source_attribution, observed_at, confidence y provenance; paginación, validación y manejo de errores.

5. Cumplimiento, seguridad y costos

Verificar condiciones de cada fuente y licencias de mapas, geocodificación, Street View y datos OSM; no eludir bloqueos. Facebook/Marketplace: ingreso asistido salvo integración autorizada verificada.

Control de cuotas, caché compatible con licencias, rate limiting, secretos fuera del código, logs sin credenciales, backups y restauración ensayada.

Comparar costos Google Maps vs MapLibre/OSM para escenarios de uso; no asumir que Antigravity habilita APIs gratuitas.

6. Fases y puertas de calidad

F0: validar polígonos, fuentes, términos y dataset de muestra. F1: POC mapa y Street View. F2: fichas, filtros y clasificación. F3: fuentes piloto y deduplicación. F4: señales territoriales y novedades. F5: móvil y robustez.

Cada fase requiere demo, pruebas automáticas, evidencia de criterios de aceptación y aprobación humana.

7. Riesgos abiertos

Límites geográficos exactos; disponibilidad de datos de portales; geocodificación incompleta; derechos de fotos; métricas de precio por cuadra; sombras solares; falsos positivos en duplicados.

Resolver mediante spikes técnicos y evidencia, no suposiciones.