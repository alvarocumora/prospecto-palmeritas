# Cholqui: análisis satelital visual + inversionistas de la SPV

Objetivo: que Cholqui pase de una ficha estática a un activo presentable a inversionistas, con (1) capas satelitales reales y bien visualizadas, (2) registro de inversionistas con sus acciones en la SPV, y (3) estado de faena, producción y certificaciones.

Alcance: Cholqui primero, con estructura reutilizable para otros proyectos más adelante. La compra de acciones se registra manualmente por el equipo GeoCapitals (sin pasarela de pago).

## 1. Análisis satelital de Cholqui

Hoy no hay análisis satelital cargado para Cholqui, así que el primer paso es correrlo sobre el polígono real de pertenencias:

- Ejecutar el pipeline de análisis satelital existente sobre el AOI de Cholqui (índices de alteración: óxidos de hierro, arcillas, sílice) y guardar las anomalías resultantes asociadas al proyecto.
- Nueva pestaña "Satélite" en la vista Cholqui (panel y live view) con:
  - Mapa con capas conmutables: pertenencias, Mina Las Minitas, puntos de muestreo P1–P3 y las 29 observaciones, anomalías satelitales por índice.
  - Leyenda con escala de severidad y control de opacidad por capa.
  - Selector de fecha/escena cuando haya más de una corrida.
  - Ficha lateral al hacer clic en una anomalía: índice, score, área (ha), fecha, distancia al punto de muestreo más cercano.
- Panel de correlación: tabla que cruza cada anomalía con la evidencia de terreno cercana (ensayos, litología), para argumentar targets sin afirmar recursos.
- Etiquetas de procedencia visibles: "detección satelital — no verificada en terreno" en cada capa derivada.

Si el pipeline no devuelve datos utilizables para el AOI, la pestaña muestra un estado vacío honesto con el motivo, en vez de datos inventados.

## 2. Inversionistas y cap table de la SPV

- Registro de la SPV que opera Cholqui: razón social, RUT, total de acciones emitidas, valor por acción, moneda, fecha de constitución.
- Registro de inversionistas ligado a la cuenta de usuario: al aprobar un inversionista, el equipo registra acciones suscritas, monto pagado, fecha, instrumento y documento de respaldo.
- Portal del inversionista (usuario autenticado, solo su propia posición):
  - Acciones que posee, % de participación, monto invertido, fecha de ingreso.
  - Historial de movimientos (suscripciones, aumentos).
  - Acceso al data room de Cholqui, ficha PDF y deck.
  - Estado de avance del proyecto en tiempo real (sección 3).
- Panel staff (Capital): cap table completo de la SPV con total emitido vs. suscrito, gráfico de participación, y alta/edición/anulación de posiciones con auditoría de quién y cuándo.
- Certificado de participación en PDF con colorimetría GeoCapitals, QR de verificación y hash de versión, descargable por el inversionista.

## 3. Etapa de producción, faena y certificación

- Línea de tiempo de etapas del proyecto (exploración → muestreo → permisos → habilitación de faena → producción), cada etapa con estado, fecha y evidencia asociada.
- Panel de faena: indicadores operacionales cuando existan (tonelaje procesado, leyes, entregas a ENAMI), con estado "sin datos" cuando no haya registro real.
- Registro de certificaciones y permisos: tipo, emisor, número, vigencia, archivo adjunto y estado (vigente / en trámite / vencido), con alertas de vencimiento.
- Cada dato lleva su etiqueta de procedencia (Declarado / A verificar / Certificado), consistente con la ficha y el PDF actuales.

## 4. Coherencia de datos

- Todo lo nuevo se lee y escribe contra una única fuente por proyecto; la ficha, el live view, el PDF de inversión y el portal del inversionista muestran las mismas cifras.
- Los disclaimers actuales se mantienen: sin recursos ni reservas certificadas, sin VAN/TIR, escenarios ilustrativos.

## Detalles técnicos

- Base de datos: nuevas tablas `spv_entities`, `spv_positions` (posición por usuario), `spv_position_events` (auditoría), `project_stage_timeline`, `project_operations_metrics` y `project_certifications`, todas en `public` con GRANT explícito, RLS activo y políticas: el inversionista solo lee su fila; staff de capital lee y escribe vía `is_geocapitals_staff()`.
- Satélite: reutilizar `satellite_anomalies`, `hyperspectral_products` y el flujo de análisis existente; nuevos componentes en `src/features/franco/components/` sobre el mapa Leaflet ya usado por `FrancoPertenenciasMap`.
- Lecturas y escrituras vía `createServerFn` con los middlewares de rol ya existentes (`requireCapitalRole`); nada de acceso directo desde el cliente a tablas sensibles.
- UI con tokens semánticos Institutional Modernist (`data-theme="im-light"`), sin hex hardcodeados.
- Certificado PDF siguiendo el patrón de `cholquiPdf.ts` (jsPDF + QR + hash).
