# Visor geocientífico interactivo con datos reales (GeoScene3D)

Objetivo: que el visor de cada proyecto se lea como una estación geológica (referencia Vulcan / Leapfrog / ArcGIS), con información real y su procedencia, y sin inventar profundidad ni cuerpos minerales.

## Lo que se ve hoy (captura de Cholqui)
- El selector Planta/Perspectiva quedó fuera del mapa, encima de las pestañas.
- El catastro, con 150 pertenencias en azul fuerte, tapa el relieve, las vetas y las anomalías.
- Los círculos grises y los arcos de colores no tienen leyenda ni se pueden identificar al verlos.
- El botón de Capas no se ve. «Evidencia 12» y «6 capas» no explican qué hay en el mapa.
- No hay ficha al tocar un elemento, ni leyenda geológica, ni regla de visibilidad según el acercamiento.

## Datos reales disponibles (verificados)
| Dato | Cholqui | Los Verdes |
|---|---|---|
| Catastro SERNAGEOMIN | sí | sí |
| Relieve CAD del titular + relieve regional | sí | relieve regional |
| Vetas medidas (rumbo y manteo) | 9 | — |
| Lineamientos Sentinel-1 | 176 | — |
| EMIT / ASTER (modeladas) | 5.687 puntos | EMIT |
| Carta geológica oficial (unidades y fallas) | sin carta publicada | Carta Illapel M431 |
| Magnetometría | solo de demostración (oculta) | — |
| Sondajes y labores | no hay | no hay |

Lo que no existe no se dibuja: aparece como «Sin datos — falta archivo» en la ficha de capas.

## Fases

### Fase 1 — Orden y lectura (frontend, sin datos nuevos)
1. Devolver Planta/Perspectiva y las herramientas a una barra dentro del mapa, sin chocar con las pestañas.
2. Jerarquía del mapa: catastro solo con contorno fino; las pertenencias del proyecto destacadas y las vecinas en gris. Nombre de la pertenencia solo al acercarse o al seleccionarla.
3. Panel de capas siempre a mano, plegable, con conteo real por capa, sello de procedencia y control de opacidad en todas las capas.
4. Leyenda viva: muestra solo lo encendido (colores de unidades, tipos de falla, firmas espectrales, prioridad de targets).

### Fase 2 — Ficha interactiva al tocar un elemento
Un panel lateral con los atributos reales de cada tipo de elemento:
- **Pertenencia:** rol, titular, hectáreas, situación y vencimiento (SERNAGEOMIN).
- **Veta:** rumbo, manteo, fuente (Arcos/Leman), lineamientos coincidentes y halo EMIT a 300 m.
- **Unidad geológica:** formación, edad, litología y hoja oficial.
- **Falla:** tipo y manteo.
- **Firma espectral:** mineral, intensidad, sensor y fecha.

Cada ficha cierra con su procedencia (OFICIAL / MEDIDO / MODELADO / INTERPRETADO) y su advertencia.

### Fase 3 — Geología y geofísica como superficies
1. Unidades de la carta oficial coloreadas según su edad o código, sobre el relieve, con opacidad regulable.
2. Firmas espectrales como mapa de densidad continuo, con filtro de intensidad (Top 5 % / Top 10 % / Todas). Los óxidos de hierro vienen apagados de inicio.
3. Opción de terreno transparente, para ver bajo la superficie las vetas inclinadas y los futuros sondajes.

### Fase 4 — Herramientas de análisis
1. Corte A–A′ fijo, que muestra en el perfil las unidades oficiales y las fallas que cruza.
2. Medición de distancia, desnivel y área.
3. Red estereográfica de las vetas medidas.
4. Exportar la vista actual al informe PDF institucional, con su leyenda y procedencia.

### Fase 5 — Datos que hoy faltan (requiere archivos del titular)
- Carta geológica de Cholqui (del informe o en archivo de mapa).
- Magnetometría real, con archivo fuente.
- Sondajes (collar, survey y leyes) y labores, para niveles subterráneos estilo Vulcan.
- Modelos OMF/DXF de vetas y cuerpos.

El visor ya está preparado para recibirlos: al cargarlos, aparecen solos.

## Detalles técnicos
- Un solo motor: GeoScene3D (MapLibre + deck.gl). Los cambios van en `GeoSceneCanvas`, `SceneLayerPanel`, `ProjectTerminalShell` y en un `FeatureInspector` nuevo y compartido, que reemplaza el tooltip.
- Visibilidad por escala con `minZoom` y `maxZoom` en el registro de capas. La paleta de unidades sale de `CODIGO` y el período, nunca de colores inventados.
- Mapa de densidad espectral con `HeatmapLayer` (Planta) o malla drapeada (3D). El filtro por percentil se calcula en el cliente.
- Terreno transparente: opacidad de la malla CAD/DEM, con `depthTest` ajustable.
- Sin cambios de backend ni de esquema. Se agregan pruebas para la paleta, el percentil, la visibilidad por escala y el mapeo de atributos de las fichas.
- Validación con Playwright en Cholqui y Los Verdes, en Planta y Perspectiva, a 1440 y 390 px.

Orden recomendado: Fase 1 y Fase 2 juntas en la primera entrega.
