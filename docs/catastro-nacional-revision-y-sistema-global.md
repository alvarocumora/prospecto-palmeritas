# Catastro Nacional — revisión de lo construido y plan del sistema global

Revisión del módulo de catastro existente y hoja de ruta para convertirlo en el
producto global (no por proyecto): búsqueda en vivo + herramientas de geometría
normativa + análisis geofísico/satelital on-demand + documentos legales
(pedimentos/manifestaciones) + servicio de vigilancia.

## 1. Lo que YA está construido (no reconstruir)

| Pieza | Archivo | Estado |
|---|---|---|
| **Cliente canónico SERNAGEOMIN v2** | `src/lib/sngm.ts` | ✅ Marcelo_Layer/2 (~103k concesiones), vértices, **eliminadas** (terreno liberado), yacimientos, geología 10k, relaves. `sngmQueryGeoJSON` con bbox/where/paginación. |
| **Fuente correcta** (el server legacy está caído) | `src/lib/sngm.ts` | ✅ ArcGIS Online, la misma reachable que usan los conectores Python. |
| **4 tipos legales** (explotación/exploración/**mensura**/**manifestación**) | `sngm.ts` `SNGM_WHERE_BY_TIPO` | ✅ modelados como TIPO×SITUACIÓN. |
| **Búsqueda global multi-país** | `src/features/catastro-public/GlobalCadastreSearch.tsx` | ✅ Capa Catastral Universal (CL/PE/BR/ZM/MW), por titular/RUT/rol, i18n ES/EN/PT, server fn `searchGlobalCadastre`. |
| **Shell público** | `PublicCatastroShell.tsx` | ✅ nav: Mapa nacional · Búsqueda · Alertas · Documentos · Login. |
| **Capa nacional en vivo** | `concesionesNacionalesLayer.ts`, `catastroLayer.ts` | ✅ render Leaflet desde Marcelo_Layer. |
| **Búsqueda por tipo** | `searchCatastro.ts`, `CatastroSearch.tsx` | ✅ filtro por TIPO_CONCESION. |
| **Dibujo en mapa** | `src/components/map/DrawingTools.tsx` | ✅ polígono/línea/marcador + export GeoJSON (freeform). |
| **Solape con catastro** | `CatastroOverlapPanel.tsx`, `src/lib/cadastre/reconcileCadastre.ts` | ✅ reconciliación/solape. |
| **Export PDF** | `exportCatastroPdf.ts` (jsPDF) | ✅ pero project-specific (pertenencias), no escrito legal. |
| **Vigilancia (base)** | `useUnreadCatastroAlerts.ts`, `email-templates/catastro-expiration-*` | ✅ alertas de vencimiento (interno + inversor). |

**Conclusión clave:** el sistema ya es global y multi-país; NO hay que rehacerlo.
Lo que falta son 4 herramientas específicas, y conectarlas al flujo "dibujo un AOI →
consulto/genero", en vez de a los visores por proyecto.

## 2. Brechas vs. la visión (qué construir)

### G1 · Geometría normativa (polígonos y grillas según Código de Minería)
Hoy `DrawingTools` dibuja polígonos libres. Falta el **generador de geometría legal**:
- Pedimento (exploración): rectángulo con lados **N-S / E-W** (ejes UTM), ≤ 5.000 ha.
- Manifestación (explotación): caras N-S/E-W, superficie por hito.
- **Terreno vacante** = AOI menos catastro (incluye capa *eliminadas* = liberado).
- **Máximo rectángulo inscrito** en el vacante; **subdivisión en grilla** de paños.

Ya existe la lógica en Python: `geocapitals-remote/scripts/pedimentos.py`
(`max_rectangle`, `propose`, subdivisión). **Plan:** exponerla como *server function*
(o portar el rectángulo N-S/E-W a TS del lado cliente) y conectarla al AOI dibujado.

### G2 · Análisis geofísico/satelital on-demand para cualquier AOI
Hoy corre por proyecto (`ProjectMasterViewer` + pipeline Python). Falta el disparo
**"dibujo AOI → corre análisis"**:
- Sentinel-2 (cobertura + anomalías Al-OH/gossan) — `geocapitals-remote` pipeline.
- Geoquímica de sedimentos + franjas + yacimientos — `harvest_opportunities.py`.
- EMAG2/Bouguer/DEM — ya en el visor.
**Plan:** worker/endpoint que reciba un bbox/polígono y devuelva el bundle
(reusar `harvest_opportunities.py` y el pipeline S2). Cachear por celda.

### G3 · Documentos en formato legal (pedimentos y manifestaciones)
`exportCatastroPdf` es una tabla de pertenencias, no un **escrito**. Falta el
generador de **escrito de pedimento/manifestación** con la estructura legal:
individualización del solicitante, comuna/región, **coordenadas UTM de los vértices
(PSAD56/SIRGAS por huso)**, superficie, cara norte, y las menciones del Código de
Minería. **Plan:** plantilla legal (extiende el pipeline branded `geocapitals-docs`)
que tome vértices + datos del solicitante → PDF/borrador. **Guarda:** es borrador
para revisión de abogado de minería; no sustituye la presentación en tribunal.

### G4 · Servicio de vigilancia (subscription)
Existen alertas de vencimiento. Falta generalizarlo a **vigilancia por área/titular
de interés**: watchlist de AOIs/roles/RUTs → chequeo programado contra Marcelo_Layer
(altas, bajas por *eliminadas*, cambios de situación, vencimientos próximos) →
alertas (in-app/email). **Plan:** tabla `catastro_watches`, job programado que
diffea el catastro por watch, y feed de alertas (reusa `useUnreadCatastroAlerts`).

## 3. Arquitectura del sistema global (no por proyecto)

```
Usuario (público / suscriptor)
   │  dibuja AOI  /  pega rol|RUT|titular  /  crea watch
   ▼
Front catastro-public (GlobalCadastreSearch + Mapa nacional + DrawingTools)
   │
   ├─► sngm.ts (live)  ──────────────► Marcelo_Layer/2 (+ eliminadas, yacimientos, geología)
   ├─► server fn: opportunities(bbox) ─► harvest_opportunities.py (catastro+geoq+franjas+yac)
   ├─► server fn: geometry(aoi) ───────► pedimentos.py (vacante, rect N-S/E-W, grilla)
   ├─► server fn: rs_analysis(bbox) ───► pipeline Sentinel-2 (cobertura+anomalías)
   ├─► server fn: legal_doc(vertices) ─► geocapitals-docs (escrito pedimento/manifestación)
   └─► watches (DB) ◄── job vigilancia ─► diff catastro → alertas
```

Regla: **una sola capa de datos global** (sngm.ts + conectores), y el "proyecto" pasa
a ser solo un AOI guardado. Los visores por proyecto quedan como vistas guardadas
sobre el mismo motor.

## 4. Diferenciadores del producto (vs. propiedadminera.digital)

Vacante precalculado (incl. terreno *liberado* de la capa eliminadas) · geoquímica
medida + franjas + yacimientos · anomalías satelitales con veredicto de cobertura ·
generador de geometría legal + escrito · vigilancia por área · procedencia por capa.

## 5. Próximos incrementos (orden sugerido)

1. **G1 geometría legal** como server fn (vacante + rectángulo N-S/E-W sobre AOI dibujado) — el corazón del "generar pedimentos".
2. **G3 escrito legal** (PDF) a partir de los vértices — cierra el flujo pedir→documento.
3. **G2 análisis on-demand** por AOI (harvester + Sentinel-2).
4. **G4 vigilancia** por watchlist (AOI/rol/RUT) con alertas.

## Guardas (todo el sistema)

Procedencia por capa; vacante indicativo (confirmar prioridad/vigencia en la Oficina
Judicial Virtual); escritos = borrador para abogado de minería + Convenio 169 donde
aplique; geoquímica/yacimientos = contexto, no ley in situ; anomalía satelital =
firma espectral, no mineral medido. Fuente catastral: copia oficial SIGEX (verificar
FECHA_ACTUALIZACION vs. visor en vivo).
