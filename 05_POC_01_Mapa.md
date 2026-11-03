# POC-01 — Mapa de Caballito y Street View

## Propósito
Comprobar usabilidad, geometría, viabilidad y costos; no construir aún todos los conectores.

## Construcción
1. Preparar mapa desktop con controles de zoom, búsqueda y capas.
2. Dibujar perímetro general y Zona A; Zona B se deriva como diferencia. **Validar límites y calles exactas antes de fijar geometrías.**
3. Mostrar tramos de cuadra y ambos lados donde los datos públicos lo permitan; distinguir datos incompletos.
4. Seleccionar cuadra, ver panel lateral con datos sintéticos claramente marcados.
5. Enlace a Street View para punto seleccionado, sujeto a disponibilidad y términos.
6. Comparar MapLibre/OSM vs Google Maps con tabla de costo/licencia/funciones antes de decidir proveedor.

## Aceptación
- Desktop: mapa ocupa zona principal y panel no tapa navegación.
- Zonas A/B se visualizan sin superposición errónea y pueden corregirse.
- Cuadras sin propiedades también son seleccionables.
- Enlace Street View abre ubicación compatible o informa ausencia.
- No aparecen anuncios ni precios ficticios presentados como reales.
- Demo grabada o capturas + instrucciones locales + tests.

## No incluido
Extracción real de portales, autenticación Facebook, ARV/MAO, cálculo solar preciso.
