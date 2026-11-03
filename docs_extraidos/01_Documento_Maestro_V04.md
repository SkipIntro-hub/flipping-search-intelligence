Flipping Search Intelligence

Documento maestro de producto y especificación inicial · Versión 0.2 · 3 de noviembre de 2026

1. Propósito y criterio rector

Aplicación web desktop-first para descubrir, geolocalizar, monitorear y clasificar oportunidades inmobiliarias de flipping. El mapa y la grilla completa de cuadras son la interfaz principal. La versión móvil es complemento de recorridas, registro de fotos, notas y oportunidades. El producto inicial NO realiza underwriting financiero completo: ARV (After Repair Value) y MAO (Maximum Allowable Offer) pertenecen a un módulo posterior.

2. Decisiones confirmadas

Cobertura: Zona A prioritaria, Zona B secundaria y Extra Zona bajo demanda.

Zona A — referencias acordadas: Aranguren (norte), Avenida Eva Perón (sur), Emilio Mitre (este), Malvinas Argentinas (oeste). Trazado exacto del polígono pendiente de validación cartográfica, especialmente continuidad y cruces de calles.

Zona B — perímetro general: Gaona (norte), Acoyte/José María Moreno (este), Donato Álvarez (oeste), dos cuadras al sur de Asamblea (sur). Excluir de B el área ya incluida en A. Validar geometría real antes de cargarla como definitiva.

Tipologías: departamentos de 2 y 3 ambientes y PH; 4 ambientes solo como excepción con deterioro relevante y señales de negociación o transformación. Excluir casas y terrenos.

Búsqueda: mostrar todas las propiedades elegibles, con ordenamiento y resaltado por oportunidad; no ocultar resultados por puntaje de forma predeterminada.

Reglas de clasificación fijas, explicables y configurables por el usuario. No aprendizaje automático de pesos en el MVP.

Extra Zona: ingreso por dirección o URL, análisis rápido y expansión opcional de aproximadamente diez cuadras; conservar y reutilizar el análisis.

Experiencia: escritorio con mapa grande; móvil para consulta, registro en campo y carga ágil.

3. Usuarios, objetivos y límites

Usuario principal: inversor/gestor que investiga microzonas y necesita tomar decisiones rápidas sobre qué propiedades investigar o visitar. Resultado deseado: ficha geográfica y comercial trazable, con historial, comparables y señales de negociación. No prometer detección exhaustiva de todos los avisos ni valores transaccionales reales a partir de precios publicados.

4. Experiencia desktop

Inicio: mapa de Zona A, resumen de novedades desde la última visita, propiedades nuevas, reducciones y republicaciones.

Mapa: calles y cuadras completas, incluso sin propiedades; capas alternables de ranking territorial, orientación estimada, transporte y rangos de precio/m².

Filtros persistentes: (1) zona/ubicación, (2) tipología/superficie, (3) precio y diferencia respecto de comparables, (4) estado/señales comerciales.

Ficha lateral: fuente, enlace, foto, dirección con precisión declarada, superficie, ambientes, precio, precio/m², historia de avisos, comparables y nivel de confianza.

Acciones: Me interesa / En observación / Descartar; guardar motivo de descarte, notas, fotos y seguimiento.

Vistas: Mapa, Novedades, Seguimiento y Extra Zona. Street View mediante integración autorizada cuando corresponda.

5. Motor territorial y clasificación

Unidad geográfica: tramo de calle/cuadra, con veredas diferenciadas. Mantener barrio oficial y microzona inmobiliaria como atributos separados. Cada tramo puede tener orientación de fachada aproximada, accesibilidad peatonal a subte, tren y colectivos, entorno, y rango de precio/m² por tipología y condición. La orientación no equivale a asoleamiento real: patios, pisos y edificios vecinos modifican la luz.

Dos clasificaciones separadas: atractivo territorial de la cuadra (prioridad comercial, luego calidad residencial) y señales de oportunidad de cada propiedad (estado, descuento aparente, antigüedad, rebajas, reapariciones). Añadir indicador independiente de confianza y explicación de reglas. Pesos y umbrales iniciales: por definir y validar; no asumir porcentajes como aprobados.

6. Datos, fuentes y trazabilidad

Mapa y geometrías: evaluar OpenStreetMap + PostGIS; contrastar con datos geográficos oficiales de CABA.

Transporte: datos oficiales de estaciones, paradas y recorridos; distancia caminable en red, no solo radio euclidiano.

Precios: publicaciones históricas propias por tipología, estado, fecha y ubicación; distinguir precio pedido de cierre de operación.

Captura de portales y marketplaces: investigar por fuente APIs, licencias, condiciones de uso y límites. No asumir acceso automatizado a Facebook Marketplace ni a todos los portales.

Deduplicación: una propiedad física con múltiples publicaciones, agencias y cambios de precio.

Procedencia: conservar URL, fecha de captura, fuente, confianza de geocodificación y estado de vigencia. Ausencia de aviso no implica venta.

7. Extra Zona y móvil

Extra Zona: pantalla mínima «Pegar publicación» / «Ingresar dirección». Obtener datos disponibles, marcar faltantes y permitir expansión territorial bajo demanda. Guardar área y resultados para reutilización. Móvil: ver seleccionadas, ubicar propiedad, sacar foto, grabar nota de voz, cargar manualmente ubicación y compartir enlace a la aplicación. No exigir análisis económico durante la captura.

8. Arquitectura técnica propuesta (no aprobada)

Frontend: React/Next.js y MapLibre GL JS (WebGL) para mapa de escritorio; diseño responsive/PWA. Backend: API con PostgreSQL/PostGIS para geometría, cuadras, inmuebles, publicaciones, eventos, fuentes, comparables, clasificaciones y notas. Orquestación: n8n para tareas programadas y alertas. Hosting: evaluar Vercel para frontend y VPS existente para servicios persistentes. Google Maps/Street View sujeto a licencias, API keys y costos. Three.js solo si existe un caso 3D justificado.

9. Modelo de entidades mínimo

Zone(id, tipo, polígono, prioridad); StreetSegment(id, geometría, veredas, barrio, microzona); Property(id, localización, precisión, tipología, superficie, atributos); Listing(id, property_id, fuente, URL, precio, fecha_observación, estado); ListingEvent(id, tipo, fecha, valores); Comparable(id, property_id, criterio, evidencia); Score(id, entidad, versión_reglas, desglose, confianza); WatchItem(id, property_id, estado, notas); FieldObservation(id, fotos, voz, ubicación); Source(id, permisos, frecuencia, calidad).

10. Plan por etapas para Codex

Fase 0 · Validación

Validar polígonos A/B, calles, geocodificación, cobertura de datos, acceso a fuentes y costos de APIs. Resultado: riesgos y decisiones abiertas.

Fase 1 · Mapa navegable

Aplicación desktop-first, mapa, polígonos editables, grilla de tramos y veredas, selector de zonas y persistencia básica. Datos de prueba etiquetados.

Fase 2 · Fichas y flujo

Modelo de propiedad y publicación, ficha lateral, filtros, estados de seguimiento, alta manual, Extra Zona por dirección.

Fase 3 · Fuentes e historial

Primer conector autorizado, normalización, deduplicación, captura periódica y registro de eventos; alertas de novedades.

Fase 4 · Inteligencia territorial

Datos de transporte, orientación estimada, comparables, rangos de precio/m² y scoring fijo explicable con confianza.

Fase 5 · Campo y robustez

PWA móvil, fotografías/notas, compartir URL, permisos, auditoría, backups y pruebas de calidad.

Fase posterior · Economía

ARV y MAO como módulo independiente, con hipótesis explícitas de reforma, gastos, plazo y margen.

11. Criterios de aceptación iniciales

El usuario puede ver A y B y distinguir claramente qué geometrías fueron verificadas.

La grilla representa todos los tramos de la zona, incluidos los que no tienen avisos.

Una propiedad puede vincular múltiples anuncios sin perder historial de cambios.

El buscador conserva resultados elegibles y permite ordenar por puntuación y novedades.

Cada puntaje muestra reglas aplicadas, datos de origen, faltantes y confianza.

Extra Zona admite dirección y URL; no inventa atributos no extraíbles.

No se presenta ARV/MAO como cálculo activo del MVP.

12. Pendientes de definición antes del Issue Pack

Validación GIS de límites y cuadras reales, en especial borde sur de Zona B y continuidad del borde de Zona A.

Lista priorizada de portales y viabilidad legal/técnica de cada conector.

Pesos y umbrales de scoring, criterios de deterioro y excepciones de cuatro ambientes.

Definición de comparables: radio, tipología, superficie, estado, antigüedad y mínimo de muestras.

Presupuesto mensual de mapas, geocodificación, almacenamiento y captura.

Frecuencia de monitoreo, retención histórica, alertas y seguridad de acceso.

Estado: documento maestro v0.1 para revisión. No equivale todavía a Issue Packs ejecutables ni a verificación de datos cartográficos o integraciones.

Anexo V0.2 — Desarrollo agnóstico y prueba de concepto

Estado: propuesta para revisión de producto durante dos días. No implica que el prototipo esté construido ni que las integraciones estén autorizadas o verificadas.

1. Principio de independencia

La especificación funcional es independiente del agente y del IDE: puede implementarse con Antigravity + Gemini, Codex u otro entorno. GitHub conserva el código y la trazabilidad; los criterios de aceptación son idénticos en cualquier entorno. No acoplar los datos maestros a un proveedor de mapas.

2. Prueba de concepto prioritaria (POC-01)

Pantalla desktop-first con mapa grande y panel lateral, usando datos simulados identificados como tales.

Dibujar Zona A (Aranguren / Eva Perón / Emilio Mitre / Malvinas Argentinas) y Zona B (perímetro general acordado), validando intersecciones y geometrías antes de afirmar que los polígonos son exactos.

Construir grilla de cuadras y veredas dentro del polígono con identificadores estables; mostrar también cuadras sin publicaciones.

Seleccionar un punto o dirección, centrar mapa y ofrecer apertura de Street View cuando exista cobertura, sin prometer dirección exacta si el aviso es aproximado.

Probar mapa con una capa de propiedades ficticias, ficha lateral, filtros y estados Me interesa / Observación / Descartar.

Documentar APIs, claves, cuotas, facturación, términos de uso y limitaciones de datos; no incluir claves en el repositorio.

3. Criterios de aceptación de POC-01

La interfaz funciona en escritorio y permite activar/desactivar zonas y grilla.

Cada cuadra visible puede seleccionarse y muestra identificador y límites de referencia.

Una dirección válida centra el mapa; errores y geocodificación aproximada se muestran explícitamente.

Street View se abre cuando hay cobertura y se informa cuando no la hay.

No se presentan publicaciones reales ni precios reales sin una fuente comprobable.

El repositorio incluye README con pasos de ejecución, costos potenciales, configuración y evidencia de pruebas.

4. Evaluación de Google y alternativas

Comparar Google Maps Platform con MapLibre/OSM para cartografía, geocodificación, Street View, rutas a pie, límites de licencia, cuotas y costos. Google Maps Platform no concede acceso a los portales inmobiliarios. La Solar API debe evaluarse por cobertura y adecuación: no se presume que calcule asoleamiento de fachadas de CABA. PostGIS permanece como opción de base geoespacial; n8n, como orquestador posible.

5. Secuencia para el agente de programación

Issue 01: proyecto web, estructura, README y configuración segura.

Issue 02: mapa y polígonos A/B validados.

Issue 03: generación y selección de grilla de cuadras/veredas.

Issue 04: geocodificación y Street View con manejo de cobertura y errores.

Issue 05: fichas y filtros con dataset ficticio.

Issue 06 (posterior): evaluación de conectores reales fuente por fuente, sujeta a acceso y términos.

6. Revisión de producto en dos días

Día 1 — interpretación: comprobar límites, grilla, interacción mapa-ficha, filtros y exclusiones de tipologías. Registrar discrepancias contra el brief, sin ampliar alcance.

Día 2 — valor: evaluar si el mapa permite identificar una oportunidad en menos pasos que el flujo actual, si las capas aportan decisiones reales y si el costo/limitaciones de APIs justifican la arquitectura. Resultado: continuar, ajustar o descartar la hipótesis de integración.

No se programa una revisión automática: el usuario retomará el análisis cuando lo considere oportuno.

Anexo V0.3 — Administrador de Fuentes Inmobiliarias

Estado: alcance funcional incorporado al núcleo del MVP; implementación sujeta a validación técnica, legal y disponibilidad de datos. Este anexo complementa V0.2 sin modificar las decisiones territoriales ni el principio de independencia del agente de desarrollo.

1. Objetivo

Incorporar sitios de inmobiliarias independientes como fuentes de oferta, además de Zonaprop, Argenprop, Mercado Libre y, cuando exista un acceso permitido y viable, Facebook Marketplace. Identificar anuncios no detectados en las demás fuentes monitoreadas, sin asumir cobertura exhaustiva.

2. Alta de una nueva fuente

Flujo: (1) el usuario pega URL del sitio de la inmobiliaria; (2) el sistema inspecciona únicamente recursos públicos accesibles y evalúa condiciones de uso, robots.txt y controles de acceso; (3) identifica catálogo de ventas y mecanismos disponibles: sitemap, datos estructurados, HTML o feed/API autorizado; (4) presenta una vista previa de anuncios y campos recuperables, junto con nivel de confianza; (5) el usuario confirma activación; (6) se agenda monitoreo. Si no es viable, queda registrada como fuente pendiente con alternativa de importación manual o solicitud de feed.

3. Extractor por fuente

Cada inmobiliaria tiene un adaptador independiente y versionado; priorizar feeds y APIs autorizadas, luego extracción de páginas públicas compatible con las condiciones del sitio. Para contenido dinámico puede evaluarse navegador automatizado, sin evadir bloqueos, autenticación, CAPTCHAs ni restricciones. Los agentes Gemini, Codex u otros pueden proponer adaptadores, pero su ejecución requiere pruebas y aprobación.

4. Campos y procedencia

Por publicación: fuente, URL canónica, ID externo si existe, fecha de detección y última revisión, título, operación, tipo, precio/moneda, expensas si constan, superficie total/cubierta, ambientes, dirección o ubicación aproximada, descripción, fotos referenciadas y estado. Cada atributo conserva origen, fecha y grado de certeza. No inferir una dirección exacta a partir de una ubicación imprecisa.

5. Base común y deduplicación

Separar entidades Propiedad física, Publicación, Fuente e Historial de observaciones. Vincular posibles anuncios de la misma unidad mediante dirección normalizada, edificio/piso/unidad cuando consten, m², ambientes, fotografías y texto. Usar coincidencia probabilística y revisión manual para casos dudosos. Mantener simultáneamente todas las publicaciones, sus precios y enlaces; nunca fusionar irreversiblemente por similitud débil.

6. Monitoreo y cambios

Frecuencia configurable por fuente según autorización, estabilidad y carga permitida. Registrar primera/última observación, altas, cambios de precio, modificaciones y desapariciones. Una publicación ausente se marca “no detectada” o “retirada”, nunca “vendida” sin evidencia adicional. Alertar por novedades dentro de Zona A/B y por cambios de propiedades seguidas; no multiplicar alertas por anuncios duplicados.

7. Descubrir inmobiliarias de mi zona

Función de búsqueda y armado de directorio de inmobiliarias con presencia en Caballito y Parque Chacabuco, con sitio web, cobertura declarada, estado de análisis y elegibilidad. El usuario elige cuáles activar; no se incorpora una fuente a extracción periódica sin revisión de condiciones de acceso.

8. Indicadores de valor de fuente

Mostrar anuncios activos detectados, porcentaje con ubicación útil, tasa de errores, última revisión exitosa y proporción de anuncios sin coincidencia en el universo monitoreado. Denominar este último indicador “aparentemente exclusivos entre fuentes observadas”, no exclusividad de mercado. Permitir comparar precio de la misma unidad entre fuentes, con fecha de observación.

9. Interfaz de administración

Tabla de fuentes con URL, nombre, estado (pendiente / apta / activa / pausada / error), método de obtención, última revisión, anuncios válidos, coincidencias y fallas. Acciones: analizar URL, previsualizar, activar/pausar, revalidar y revisar errores. Mostrar por qué un sitio no puede conectarse y cómo incorporar sus datos de otro modo.

10. Entrega incremental para agentes

Issue FS-01: pantalla de alta URL y directorio de fuentes con datos simulados. FS-02: modelo Fuente/Publicación/Propiedad/Observación y pruebas de deduplicación. FS-03: primer conector de inmobiliaria independiente, seleccionado tras verificar permisos. FS-04: monitoreo, historial y alertas. FS-05: descubrimiento de inmobiliarias y métricas de aporte diferencial. Mantener esta secuencia agnóstica de Antigravity, Codex o Gemini.

11. Criterios de aceptación MVP

Con una fuente piloto permitida: analizar URL y mostrar previsualización; importar publicaciones con origen verificable; reejecutar sin duplicar unidades; detectar un cambio de precio simulado y conservar el anterior; vincular dos anuncios de una misma unidad con confirmación manual cuando corresponda; pausar conector; señalar extracción fallida sin alterar datos históricos. Las fuentes no autorizadas deben poder registrarse sin extracción automatizada.

12. Riesgos y decisiones abiertas

Definir primera inmobiliaria piloto y autorización aplicable; frecuencia inicial de revisión; política de almacenamiento de fotos (preferir enlaces y respetar licencias); tratamiento de datos personales; umbrales de coincidencia y aprobación humana; disponibilidad real de Marketplace y grandes portales. La cobertura se ampliará solo tras medir estabilidad, costo y aporte de cada fuente.

ANEXO V0.4 — DUEÑO DIRECTO Y CONSOLIDACIÓN MULTIFUENTE

Actualización 03/11/2026 · Alcance: núcleo del MVP · Estado: especificación funcional, sin conectores implementados.

1. Principio rector

Una propiedad física tiene una ficha consolidada y puede estar asociada a múltiples publicaciones, fuentes y observaciones históricas. No confundir anuncio retirado con venta confirmada. Mantener siempre URL, fecha y procedencia.

2. Nuevas categorías de origen

Incorporar Dueño Directo — sitio especializado; Dueño Directo — grupo de Facebook; Dueño Directo — Marketplace. Conservar también Portal inmobiliario, Inmobiliaria independiente y Carga manual. “Dueño directo” es una condición declarada hasta que exista evidencia de verificación.

3. Sitios especializados

Alta de fuente por URL; inspección de catálogo y formatos públicos; propuesta de conector sólo si el acceso es autorizado y compatible con las condiciones del sitio. Admitir importación asistida si la automatización no está permitida.

4. Grupos de Facebook y Marketplace

Registrar nombre, enlace y zona del grupo como fuente referencial. Permitir compartir enlace, pegar texto, subir captura o cargar datos manualmente; extraer campos desde el material aportado y pedir confirmación antes de incorporar. No asumir acceso a grupos privados ni disponibilidad de API o scraping masivo; no automatizar accesos mediante evasión de restricciones.

5. Flujo único de incorporación

Capturar → interpretar → normalizar campos → detectar posibles duplicados → confirmar coincidencia cuando haya incertidumbre → geolocalizar con precisión declarada → agregar ficha a mapa → clasificar (Me interesa / En observación / Descartar) → conservar historial.

6. Monitoreo y trazabilidad

Distinguir estado de fuente: automático autorizado / asistido / manual. Para fuentes automáticas registrar altas, cambios de precio y desapariciones; para Facebook y Marketplace, registrar última verificación manual y permitir actualización por nuevo enlace, texto o captura. No prometer notificaciones de cambios que no puedan verificarse.

7. Modelo mínimo de datos

Fuente: id, categoría, nombre, URL, condiciones, método y estado de acceso. Publicación: id, fuente, URL, id externo, texto, precio, fecha de observación, evidencia. Propiedad: id interno, tipología, ubicación exacta o aproximada, atributos, confianza de deduplicación. Observación: instante, cambios, evidencia. Estado de seguimiento y notas del usuario separados de la publicación.

8. Vista unificada y señal de oportunidad

En una ficha, mostrar todas las fuentes, precios por fuente, fechas, evidencia, nivel de certeza de coincidencia y condición “dueño directo declarado”. Mostrar una señal de exclusividad sólo como “no detectada en otras fuentes monitoreadas”, nunca como exclusividad comercial confirmada.

9. Entregas incrementales para Antigravity / Gemini / Codex

DD-01: categorías de fuente y esquema de datos. DD-02: importación manual por enlace, texto o captura con confirmación. DD-03: deduplicación y ficha multifuentе. DD-04: panel de procedencia y estados de actualización. DD-05: piloto de sitio de dueño directo con acceso autorizado. DD-06: registro de grupos Facebook y flujo asistido; sin prometer monitoreo automático.

10. Criterios de aceptación

Una publicación de dueño directo se incorpora desde texto o captura; conserva origen y fecha; puede asociarse a una propiedad ya existente sin duplicar ficha; distingue datos declarados de verificados; muestra cuándo fue revisada; y nunca informa cambios automáticos sin fuente de observación válida.

11. Límites y pendientes

Validar condiciones de cada fuente, privacidad y tratamiento de datos personales; definir frecuencia y política de retención de capturas; evaluar costo de procesamiento de imágenes; elegir fuentes piloto. La cobertura total de Facebook no está garantizada y no es requisito bloqueante del MVP.