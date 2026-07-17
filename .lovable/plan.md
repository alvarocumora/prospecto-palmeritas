## Diagnóstico

Verifiqué los tres puntos y confirmé por qué no se ve el cambio:

1. **PDF sin cambio visual real.** El renderer actual (`src/lib/documents/pdf.ts`) sigue con `contacto@geocapitals.com` (línea 24), sin marca de agua, con el título pegado al QR y con firmas donde la meta REF/fecha choca con el bloque QR. Los "rediseños" anteriores no quedaron persistidos en el archivo activo. El PDF que subiste lo confirma: header duplicado, tabla de campos con acento cobalto plano, cláusulas apretadas y footer con el correo viejo.
2. **Ubicaciones en el mapa incorrectas.** Los 4 listings tienen `geometry_geojson = NULL` en base de datos. El mapa cae a coordenadas por defecto/región, por eso no coinciden con Los Verdes, Palmeras, Gianfranco y Cornellana reales.
3. **Valorizaciones inconsistentes.** `asking_price_usd` es un número manual (2 en NULL, 2 fijos). `computeListingValuation` corre con inputs derivados del listing (área, commodity) pero ignora los datos "live" que ya existen: anomalías satelitales, targets, `economic_scenarios`, sondajes en `synthetic_drillholes`, etc. Por eso el precio pedido y la valorización estimada divergen.

## Cambios propuestos

### 1) PDF transaccional — rediseño real y verificable
Reescritura completa de `src/lib/documents/pdf.ts` con:
- Correo oficial `info@geocapitals.com` en header, footer y CTA.
- Grid layout de 12 columnas con canaletas fijas: título ocupa cols 1–8, bloque QR cols 9–12 (nunca se solapan).
- Marca de agua tenue "GEOCAPITALS" a 8% cobalto en cada página.
- Portada con cover band cobalto + eyebrow "DOCUMENTO TRANSACCIONAL" + tipografía serif display para título.
- Tabla de campos con filas alternadas papel/papel-2, labels en cobalto small-caps.
- Cláusulas con numeración en badge cobalto y sangría francesa.
- Bloque de firmas con reserva de altura calculada (sello + nombre + hasta 3 líneas de parte + meta) y salto de página si no cabe entero.
- Footer de 3 columnas fijas: marca+disclaimer / contacto (email+WhatsApp) / mini-QR + paginación.
- Header de continuación en páginas ≥2 con REF + `info@geocapitals.com`.

Aplicar la misma pasada a `src/lib/tradeDocPdf.ts` (usa el mismo renderer base) para unificar identidad en NDA/SPA/NDI/LOI/Term Sheet.

Actualizar `src/routes/verificar.$ref.tsx` para reemplazar los dos `contacto@geocapitals.com` restantes por `info@geocapitals.com`.

**QA obligatorio:** generar los 5 tipos de documento vía Playwright, convertir con `pdftoppm` e inspeccionar visualmente cada página antes de cerrar.

### 2) Ubicaciones reales en el mapa de proyectos
- Migración que rellena `geometry_geojson` de los 4 listings publicados con los centroides reales que ya existen en el repo:
  - Los Verdes → `src/data/geo/aoi.geojson` (Tilama, Coquimbo)
  - Palmeras → `src/data/geo/palm_clusters.geojson` (Alhué, RM)
  - Gianfranco → `src/data/geo/franco_pertenencias.geojson` (Valparaíso)
  - Cornellana → coordenadas del proyecto en `src/features/*/data/project.ts`
- `ListingsMap` ya lee `geometry_geojson`; solo hay que asegurar fallback ordenado por región cuando siga en null (no romper marcadores).

### 3) Valorización coherente con datos live
- Extender `computeListingValuation` (`src/lib/valuation/valuation.functions.ts`) para leer, cuando exista `project_id`:
  - `economic_scenarios` (NPV/IRR reales del proyecto) → alimenta método DCF en vez de sintético.
  - `exploration_targets` + `satellite_anomalies` → factor de confianza para in-situ metal value.
  - `synthetic_drillholes` / `resource_models` → tonelaje y ley promedio.
- Recalcular `asking_price_usd` como P50 de los métodos disponibles y persistirlo vía migración solo para los 4 listings actuales (dejando manual override si el owner ya fijó valor).
- Mostrar en `ValuationPanel` la fuente de cada input (badge "live · economic_scenarios", "live · targets", "sintético") para que el usuario vea de dónde viene cada número.

## Detalles técnicos

- Todos los tokens del PDF salen de constantes ya alineadas a `src/styles.css` (PAPER, INK, COBALT, HAIRLINE); nada hardcodeado fuera del renderer.
- La migración de `geometry_geojson` usa `ST_SetSRID(ST_GeomFromGeoJSON(...), 4326)` vía `geometry_geojson jsonb` (columna ya es JSONB, no requiere PostGIS write).
- El recálculo de `asking_price_usd` se hace en SQL con un `UPDATE ... WHERE id IN (...)` a partir de una CTE que agrega `economic_scenarios.npv_usd` cuando existe; si no, deja el valor actual.
- QA de PDFs: script Playwright headless que descarga cada plantilla desde `/dashboard/documentos/{templateId}`, guarda el blob y renderiza con `pdftoppm -r 130`.

## Fuera de alcance

- No se toca la UI del editor de documentos ni las plantillas (`templates.ts`) más allá de lo necesario para pasar el nombre del emisor.
- No se agregan nuevas plantillas ni nuevos métodos de valorización; se conectan mejor los existentes.
- No se cambia el sistema de auth ni el flujo de firma.
