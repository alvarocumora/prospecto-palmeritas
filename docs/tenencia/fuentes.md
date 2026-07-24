# Fuentes de datos — Módulo de Tenencia y Propiedad Minera

> Estado por fuente: **VERIFICADO** (endpoint/código confirmado), **DIRECTORIO** (existe
> según catálogo/documentación oficial pero no se pudo abrir desde el entorno de build),
> **PENDIENTE** (se verifica en su fase). Regla dura (§3): si una capa no está disponible,
> el informe declara _"capa no verificada"_ — nunca se rellena con estimaciones.

Fecha de esta investigación: 2026-07 · Entorno: contenedor de build (IP datacenter, EE.UU.).

## Decisión de arquitectura (2026-07): se construye SOBRE el módulo existente

El módulo NO es greenfield ni un servicio Python aparte. `prospecto-palmeritas` ya tiene un
subsistema de catastro/concesiones con **PostGIS** (Supabase, schema `extensions`), un
**visor nacional SERNAGEOMIN en vivo** (`catastro.mapa.tsx`, esri-leaflet FeatureServer),
un **RPC de traslape real** (`franco_match_pertenencia`, `ST_Intersection`/`ST_Area`),
workspace de catastro por proyecto (concesiones/titulares/patentes/traslapes/watch/sync) y
**`proj4`** como dependencia. La visión de Tenencia se implementa como capa de
consolidación y generalización sobre eso, en `src/lib/tenencia/` (TypeScript), reutilizando
la ingesta SERNAGEOMIN ya existente. Los datums (§4) usan **proj4**, no pyproj.

> **Blocker de alcance resuelto:** SERNAGEOMIN rechaza este entorno de build, pero la
> ingesta real corre vía edge functions Supabase / esri-leaflet en cliente pidiendo
> `outSR=4326` (la reproyección la hace el ArcGIS server). No se depende de alcanzar
> SERNAGEOMIN desde este contenedor.

## Datum (§4) — IMPLEMENTADO: `src/lib/tenencia/datum.ts` (proj4)

- Transformación PSAD56→WGS84 **por franja latitudinal** (parámetros verificados en epsg.io):
  N de 26°S = EPSG:6971 `[-302, 272, -360]` · 26–36°S = 6972 `[-328, 340, -329]` ·
  36–43°30'S = 6973 `[-352, 403, -287]` (geocentric translations, 10 m/eje).
- Almacenamiento canónico **EPSG:4326**; conversión en los bordes. Detección de huso 18S/19S
  por longitud; SIRGAS-Chile ≈ WGS84 (GRS80).
- **Tests (`datum.test.ts`, pasan):** round-trip <0,5 m; selección de franja; magnitud del
  corrimiento 80–500 m; **punto de control de proyección PMD** (screenshot IMG_2278, lectura
  oficial PSAD56 IGM Sur) reproducido a <1 m.
- **Gate §4 PENDIENTE:** el test de **cambio de datum** (PSAD56↔WGS84) exige ≥10 puntos con
  coordenadas conocidas en AMBOS datums (hitos IGM / planos de mensura). Hoy hay 0 → marcado
  `todo` en el test. No se inventan. Ver `control-points.json`.

---

## Nota de alcance del entorno (importante)

El servidor de SERNAGEOMIN (`catastromineronline.sernageomin.cl`) **rechaza la conexión
desde este entorno** (`Connection reset by peer` en el handshake TLS): geobloqueo o bloqueo
de IPs de datacenter. Consecuencia operativa: **el ETL que baja datos reales no puede
ejecutarse ni testearse desde este contenedor**. Se resuelve corriendo el ETL desde un
runner con IP Chile, o ingiriendo el _shapefile/File-GDB_ de descarga anual que publica
SERNAGEOMIN. Los IDs de capa y el SRID nativo exactos quedan **por confirmar contra el
servicio real** (no se inventan aquí).

---

## F1 — Concesiones SERNAGEOMIN (núcleo del módulo)

| Campo                       | Valor                                                                                                                             | Estado                                |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| Organismo                   | Servicio Nacional de Geología y Minería (SERNAGEOMIN), Depto. de Propiedad Minera                                                 | —                                     |
| Plataforma                  | Catastro Minero Online (ArcGIS Server)                                                                                            | DIRECTORIO                            |
| Base REST                   | `https://catastromineronline.sernageomin.cl/arcgismin/rest/services/MINERIA/`                                                     | DIRECTORIO                            |
| Servicio huso 18S           | `.../MINERIA/WMS_PROPIEDAD_MINERA_18S/MapServer`                                                                                  | DIRECTORIO                            |
| Servicio huso 19S           | `.../MINERIA/WMS_PROPIEDAD_MINERA_19S/MapServer` (análogo — **por confirmar**)                                                    | PENDIENTE                             |
| Protocolos                  | ArcGIS REST (`/query`, `/export`) + OGC WMS/WFS/WCS (según docs SERNAGEOMIN)                                                      | DIRECTORIO                            |
| Formato de consulta         | GeoJSON/EsriJSON vía `/query?f=geojson` (por confirmar límite `maxRecordCount`)                                                   | PENDIENTE                             |
| Cobertura histórica         | Propiedad minera y concesiones de explotación desde 1932 (según metadatos del servicio)                                           | DIRECTORIO                            |
| SRID nativo                 | **Por confirmar** contra `?f=json` → `spatialReference.wkid`. Probable UTM huso-dependiente (PSAD56 o SIRGAS-Chile).              | PENDIENTE                             |
| Capas requeridas            | Exploración vigente · Explotación vigente · Históricas/extinguidas · Pedimentos · Manifestaciones                                 | PENDIENTE (mapear IDs reales)         |
| Licencia                    | Datos públicos SERNAGEOMIN (uso referencial; la BD oficial del Depto. de Propiedad Minera prevalece). Confirmar términos exactos. | PENDIENTE                             |
| Descarga masiva alternativa | Shapefile/GDB anual del catastro (para ingesta sin depender del REST en vivo)                                                     | PENDIENTE (localizar URL de descarga) |

App de referencia (visor oficial): `https://appsngmaz.sernageomin.cl/catastro_SNGM/home/index`

**Acción antes de codear el ETL:** abrir `.../MapServer?f=json` desde IP Chile/navegador y
pegar aquí: `spatialReference.wkid`, la lista `layers[]` (id+name), `capabilities`
(¿`Query`?) y `maxRecordCount`. Sin eso, el ETL se construye contra un esquema de capas
supuesto y se marca como no verificado.

---

## Sistemas de referencia (§4) — códigos EPSG

CRS base (proyectados, metros):

| CRS                                   | EPSG      | Estado                                                                       |
| ------------------------------------- | --------- | ---------------------------------------------------------------------------- |
| PSAD56 / UTM 19S                      | **24879** | VERIFICADO (epsg.io: "PSAD56 / UTM zone 19S", datum PSAD56, Chile N de 45°S) |
| PSAD56 / UTM 18S                      | **24877** | VERIFICADO (par estándar de 24879; confirmar nombre en epsg.io)              |
| WGS84 / UTM 18S                       | **32718** | VERIFICADO (estándar global WGS84 UTM 18S sur)                               |
| WGS84 / UTM 19S                       | **32719** | VERIFICADO (estándar global WGS84 UTM 19S sur)                               |
| WGS84 geográfico (canónico propuesto) | **4326**  | VERIFICADO                                                                   |
| Web Mercator (basemap MapLibre)       | **3857**  | VERIFICADO                                                                   |

SIRGAS-Chile / UTM 19S — **múltiples realizaciones** (elegir según lo que publique el organismo):

| Realización       | EPSG (19S) | Estado               |
| ----------------- | ---------- | -------------------- |
| SIRGAS-Chile 2002 | 5361       | VERIFICADO (epsg.io) |
| SIRGAS-Chile 2010 | 8951       | VERIFICADO           |
| SIRGAS-Chile 2013 | 9150       | VERIFICADO           |
| SIRGAS-Chile 2016 | 9155       | VERIFICADO           |
| SIRGAS-Chile 2021 | 20049      | VERIFICADO           |

> Los códigos 18S de SIRGAS-Chile quedan **PENDIENTE** de confirmar (misma familia).

**Transformaciones de datum — dependientes de región (crítico).** Entre PSAD56 y
WGS84/SIRGAS **no hay un único offset de 3 parámetros**: PROJ define transformaciones por
franja latitudinal. Ejemplos verificados (epsg.io):

- PSAD56 → WGS84: **6971** (N de 26°S) · **6972** (26–36°S) · **6973** (36–43°30'S)
- PSAD56 → SIRGAS-Chile 2002: **6949** (N de 26°S) · **6951** (36–43°30'S)

Implica: `pyproj`/PROJ debe elegir la transformación por ubicación del vértice (o usar
`TransformerGroup` y la más adecuada por área), **no** un Helmert único a mano (§4).

---

## Decisiones geodésicas propuestas (a confirmar)

1. **SRID canónico de almacenamiento = EPSG:4326** (WGS84 geográfico). Es lo natural para
   PostGIS + MapLibre y evita atar la base a un huso. La conversión ocurre en los bordes (§4).
2. **CRS de medición (áreas, largo/ancho, orientación) = SIRGAS-Chile 2021 / UTM 18S(20048?)
   ó 19S(20049)**, elegido por huso según longitud del centroide. Es la realización oficial
   vigente. (Confirmar el EPSG 18S de 2021 y si SERNAGEOMIN aún entrega en PSAD56.)
3. **Ingesta:** detectar el datum de origen del dato/documento y transformar a 4326 con la
   transformación PROJ **de la franja correspondiente**. Registrar el datum de origen por
   registro (trazabilidad).

---

## Fuentes de fases posteriores (PENDIENTE — verificar en su bloque)

| Capa                                           | Fuente                                                                                   | Fase  |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------- | ----- |
| Pedimentos/manifestaciones en trámite          | Boletín Oficial de Minería (PDF) — requiere parser + OCR                                 | F2/F3 |
| Derechos de agua                               | DGA / Catastro Público de Aguas                                                          | F5    |
| Predios y roles de avalúo                      | SII / IDE Chile                                                                          | F5    |
| Áreas protegidas (SNASPE, sitios prioritarios) | CONAF / MMA / IDE Chile                                                                  | F5    |
| Proyectos en evaluación ambiental              | SEA / SEIA                                                                               | F5    |
| ADI y tierras indígenas                        | CONADI / IDE Chile (si no hay capa espacial pública → modelar por comuna + carga manual) | F5    |
| Cartas geológicas                              | SERNAGEOMIN                                                                              | F6    |
| DEM                                            | Fuente pública (por definir: Alos Palsar / SRTM / IDE Chile)                             | F6    |

---

## Puntos de control para el test de datum (§4) — PENDIENTE

Se requiere un set de **≥10 vértices con coordenadas conocidas en PSAD56 y WGS84/SIRGAS**
(idealmente de un hito IGM o de un plano de mensura oficial), con tolerancia declarada.
**No se inventan.** Fuente candidata: monografías de vértices geodésicos del IGM. Bloquea
el despliegue si el test no pasa.
