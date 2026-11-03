Especificación funcional del MVP

Versión 1.0 · 03/11/2026 · Estado: especificación para validación, no software implementado

1. Alcance y prioridades

Producto desktop-first para localizar, comparar, clasificar y monitorear oportunidades de flipping; móvil como complemento de captura y consulta.

MVP: mapa, cuadras, fichas, fuentes múltiples, historial, deduplicación, filtros, alertas, Extra Zona y captura asistida. Fuera de MVP: cálculo financiero ARV/MAO, ejecución de ofertas y garantía de acceso a plataformas cerradas.

Tipologías: departamentos de 2 y 3 ambientes y PH; 4 ambientes solo excepcionales; excluir casas y terrenos de búsqueda automática.

2. Geografía

Perímetro de estudio: Gaona (N), Acoyte–José María Moreno (E), Donato Álvarez (O), dos cuadras al sur de Asamblea (S). Validar geometría exacta antes de implementar.

Zona A prioritaria: Aranguren (N), Eva Perón (S), Emilio Mitre (E), Malvinas Argentinas (O). Zona B: resto del perímetro general. Extra Zona: dirección o URL fuera del perímetro, ampliación opcional de ~10 cuadras.

Representar ambas veredas y tramos de cuadra incluso sin publicaciones. No inventar números de puerta ni ubicaciones exactas.

3. Navegación desktop

Secciones principales: Mapa, Novedades, Seguimiento, Extra Zona, Fuentes.

Mapa ocupa la mayor superficie; barra de filtros y capas, panel lateral de ficha y comparación; capas de precios, transporte, orientación y confianza.

Al abrir: zona A, resumen de novedades desde última visita; nunca afirmar conteos sin registros.

4. Filtros y ranking

Cuatro filtros principales: zona; tipología/superficie; precio relativo y USD/m²; condición y señales de negociación.

Avanzados: luz/orientación, piso, balcón, cochera, expensas, antigüedad, transporte, potencial de redistribución.

Puntuar por separado atractivo permanente de cuadra y oportunidad dinámica de publicación. Pesos editables y explicables, sin aprendizaje automático inicial; mostrar confianza y datos faltantes.

5. Ficha de inmueble

Campos: ID canónico, ubicación (exacta/aproximada), tipo, ambientes, m², precio y moneda, USD/m² cuando proceda, estado, fotos referenciadas, descripción, características, observaciones, orientación y fuente.

Una propiedad puede tener múltiples publicaciones y precios simultáneos. Historial con fecha de observación y fuente. Retiro de publicación NO equivale a venta.

Estados del usuario: Me interesa, En observación, Descartar; razones y notas. Enlaces a fuente y Street View cuando permitido.

6. Fuentes y alta por URL

Categorías: portales, inmobiliarias independientes, sitios dueño directo, Facebook grupos, Marketplace y captura manual.

Flujo: URL → análisis de acceso y estructura → vista previa de campos → validación humana → activar extractor o modo asistido → ingestión normalizada → deduplicación → seguimiento.

Cada fuente muestra estado: activa, asistida, restringida, fallida; última revisión, permiso/condiciones y calidad de extracción. No evadir autenticación, CAPTCHA o restricciones.

7. Deduplicación e historial

Coincidencias por dirección, área, ambientes, fotos y atributos; puntuación de similitud con revisión humana en casos ambiguos.

Guardar registros originales inmutables de observaciones, asociar publicación con inmueble canónico, permitir separar una fusión errónea y auditar cambios.

Novedades: publicación nueva, baja de precio, republicación probable, desaparición, cambio de datos; alertas solo con evidencia.

8. Extra Zona y móvil

Dos entradas mínimas: Pegar publicación / Ingresar dirección. Permitir completar precio, área y notas opcionales.

Móvil: consultar seleccionadas, cargar fotos y notas de voz, compartir enlace; permisos explícitos de geolocalización/cámara/micrófono.

Cuando dirección sea insuficiente, marcar ubicación aproximada y solicitar corrección.

9. Estados de error y criterios

Fuente no accesible: no inventar propiedades; registrar razón y permitir importación asistida. Duplicado incierto: mostrar candidato sin fusionar automáticamente.

Criterio transversal: datos reales, simulados y estimados visualmente diferenciados; sin prometer disponibilidad de APIs ni cifras verificadas.