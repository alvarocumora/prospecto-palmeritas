# Diseñador de pedimentos y manifestaciones sobre el visor

Objetivo: tocar una faena o pertenencia caducada (o cualquier sector libre), diseñar ahí el polígono, ajustar sus vértices a mano o dejar que el diseñador lo arme por normativa, y obtener un análisis satelital base del área solicitada. Todo dentro de la pestaña Pedimento del mapa del catastro.

## Qué verá el usuario

1. **Elegir el tipo de solicitud**: Pedimento (exploración) o Manifestación (explotación). Cada tipo aplica sus reglas al diseño.
2. **Punto de partida** (una de tres):
   - "Usar esta caducada": desde la ficha de un polígono gris (caducado o eliminado), se usa su huella como base.
   - "Dibujar": marcar 4 o más puntos sobre el mapa.
   - "Automático en la vista": el trazado actual del mayor rectángulo libre.
3. **Diseñador automático por normativa**:
   - Pedimento: rectángulo con lados N-S / E-W, en múltiplos de 100 m y hasta 5.000 ha.
   - Manifestación: pertenencias de 1 a 10 ha (lados en múltiplos de 100 m, N-S/E-W), agrupadas en una mensura de hasta 1.000 ha (tope por manifestación).
   - Grilla de celdas de 100 x 100 m (1 ha) sobre el mapa: se pueden añadir o quitar celdas con un clic. El sistema avisa si el conjunto deja de ser continuo o rectangular.
   - Recorte automático contra concesiones vigentes y en trámite: las celdas que chocan se marcan en rojo y se excluyen.
4. **Ajuste manual de vértices**: arrastrar cada vértice. Al soltarlo, se ajusta al múltiplo de 100 m y mantiene los lados N-S / E-W. Superficie, lados y minuta UTM se recalculan en vivo.
5. **Análisis satelital base del área pedida** (botón "Analizar área"):
   - Busca la escena Sentinel-2 más reciente con poca nubosidad sobre el polígono.
   - Calcula índices: óxidos de hierro, arcillas/alteración (SWIR), vegetación (NDVI) y pendiente desde el DEM.
   - Entrega media, percentil 90 y el % del área sobre el umbral de anomalía, más un mapa de calor dentro del polígono.
   - Todo va rotulado como MEDIDO (escena, fecha, nubosidad) o INTERPRETADO (anomalía). Nunca como ley ni recurso.
6. **Resultado**: la minuta OJV, el escrito, el KML y el GeoJSON usan la geometría final (vértices ajustados), con un resumen satelital opcional en el PDF.

## Reglas y advertencias que se mantienen

- La vacancia es indicativa. La prelación la da la fecha de ingreso en la OJV (el semáforo actual se sigue mostrando).
- Una caducada puede tener una solicitud posterior todavía no graficada. Antes de usarla, se corre automáticamente el chequeo de prelación.
- Los topes normativos usados (5.000 ha para pedimento; 1–10 ha por pertenencia y 1.000 ha por manifestación) se muestran en pantalla. Requieren validación legal.

## Detalles técnicos

- Geometría: extender `src/lib/pedimentoGeometry.ts` con `snapRectUtm` (snap a 100 m, ejes N-S/E-W), `cellGrid(aoi)` (celdas de 1 ha en UTM), `cellsToPolygon` (con validación de contigüidad/rectangularidad) y `designManifestacion` (partición en pertenencias de hasta 10 ha). Funciones puras con pruebas unitarias (topes y snap).
- Server fn `validateDesign` en `pedimento.functions.ts`: recibe el polígono final, consulta SERNAGEOMIN en vivo y devuelve las celdas en conflicto. Reutiliza la consulta actual.
- Edición en el mapa: capa MapLibre con vértices arrastrables (`mousedown`/`mousemove` sobre un círculo GeoJSON) y una capa de celdas clicable. No se agrega otra librería de mapas.
- "Usar esta caducada": botón en la ficha rápida de `catastro.mapa.tsx` que envía la geometría al workbench (bbox de la huella → diseño ajustado).
- Satelital: nueva server fn `analyzeAoiSpectral` que consulta Sentinel-2 L2A por STAC (Planetary Computer, sin clave) y calcula índices sobre el polígono (ventana COG, máximo ~5.000 ha), con caché `memoCache`. Si no hay escena válida, muestra "Sin escena válida". Sin cambios de base de datos.
- Archivos principales: `CatastroWorkbench.tsx` (dividido en `DesignerPanel`, `SpectralPanel`), `pedimentoGeometry.ts`, `pedimento.functions.ts`, nuevo `aoiSpectral.functions.ts`.

## Fuera de alcance (siguiente etapa)

- Petitorios de Perú por cuadrícula de 100 ha (mismo diseñador, otra regla).
- Guardar diseños en la cuenta del usuario (requiere tabla nueva).
