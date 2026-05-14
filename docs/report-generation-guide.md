# Guía de generación de informes — Geocapitals *by Andes Dynamics*

> **Versión:** 1.0 · 14 May 2026
> **Aplica a:** todos los informes PDF emitidos por la plataforma (Pre-NI 43-101, NI 43-101 firmado, satelital express, catastro mensual, holder profile, investor brief, bulletin alerts).
> **Referencia de implementación:** `Las_Palmeras_PreNI43-101_v8.pdf` (builder Python `/tmp/build_v8.py`) y `src/lib/pdf/primitives.ts`.
> **Audiencia:** agente IA generador, diseñadores, QPs firmantes y equipo comercial.

---

## 1. Identidad de marca

### 1.1 Nombre y claim
- **Nombre comercial:** `GEOCAPITALS`
- **Claim institucional:** `by Andes Dynamics`
- **Sub-claim por producto:** `Trackmin GeoIntel · Inteligencia minera para inversionistas`
- **Tagline corto (footer/header):** `Trackmin GeoIntel · Pre-NI 43-101`

### 1.2 Paleta — fuente única de verdad
Toda paleta debe declararse en `src/styles.css` como tokens semánticos `oklch` y replicarse en los builders Python como hex.

| Token              | Hex        | OKLCH                       | Uso                                          |
|--------------------|------------|-----------------------------|----------------------------------------------|
| `--ink`            | `#0B1320`  | `oklch(0.18 0.03 250)`      | Tinta principal, body                        |
| `--ink-soft`       | `#384152`  | `oklch(0.36 0.03 250)`      | Texto secundario, captions                   |
| `--rule`           | `#D9DEE6`  | `oklch(0.88 0.01 250)`      | Reglas finas, bordes de tabla                |
| `--paper`          | `#FAFAF7`  | `oklch(0.98 0.005 90)`      | Fondo de página (off-white cálido)           |
| `--card-bg`        | `#F2EFE7`  | `oklch(0.94 0.013 85)`      | KPI cards, callouts neutros                  |
| **`--primary`**    | `#0E5F4F`  | `oklch(0.42 0.07 165)`      | Verde institucional Geocapitals              |
| **`--primary-dk`** | `#0A3F35`  | `oklch(0.30 0.06 165)`      | Header band, portada full-bleed              |
| **`--accent`**     | `#C8A24A`  | `oklch(0.72 0.11 85)`       | Dorado (kickers, ribbon, QR fill)            |
| `--warm`           | `#B5532A`  | `oklch(0.55 0.13 45)`       | Disclaimers, alertas, Z2 (argílico)          |
| `--zone-z1`        | `#0E5F4F`  | = primary                   | Zona hidrotermal sericita-cuarzo             |
| `--zone-z2`        | `#B5532A`  | = warm                      | Zona argílica avanzada                       |
| `--zone-z3`        | `#7A6A2B`  | `oklch(0.50 0.08 95)`       | Zona óxidos / gossan                         |

> **Regla:** nunca usar colores literales en componentes (ni TS ni Python). Importar siempre del catálogo.

### 1.3 Tipografía

| Rol                       | Familia                  | Tamaño | Leading |
|---------------------------|--------------------------|--------|---------|
| Título portada            | Helvetica-Bold           | 46 pt  | 50 pt   |
| H1 sección                | Helvetica-Bold           | 18 pt  | 21 pt   |
| Kicker (sobre H1)         | Helvetica-Bold (accent)  | 8.5 pt | 10 pt   |
| H2 subsección             | Helvetica-Bold           | 12 pt  | 15 pt   |
| Body                      | Helvetica                | 10 pt  | 14 pt   |
| Lead (resumen)            | Helvetica                | 11 pt  | 15.5 pt |
| Tabla — header            | Helvetica-Bold (white)   | 8.5 pt | 10.5 pt |
| Tabla — celda             | Helvetica                | 8.8 pt | 11.5 pt |
| Caption                   | Helvetica                | 8.5 pt | 11 pt   |
| Micro (footer, hashes)    | Helvetica                | 7.5 pt | 9.5 pt  |
| Mono (clave pública/hash) | Courier                  | 8 pt   | 10 pt   |

---

## 2. Sistema de página

- **Tamaño:** A4 (210 × 297 mm).
- **Márgenes:** L 18 / R 18 / T 30 / B 22 mm.
- **Ancho útil:** `CONTENT_W = 174 mm` (toda tabla y figura debe sumar exactamente este ancho).

### 2.1 Header (todas las páginas excepto portada)
```
┌──────────────────────────────────────────────────────────────┐
│ ▌ Banda dark 14 mm — fondo PRIMARY_DK                        │
│   GEOCAPITALS  Trackmin GeoIntel · Pre-NI 43-101    TRK-…│v8 │
│ ▔▔▔▔▔▔▔▔▔▔▔▔ regla dorada 0.8 mm (ACCENT) ▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔│
└──────────────────────────────────────────────────────────────┘
```

### 2.2 Footer
- Regla fina `--rule` 0.4 pt a 6 mm sobre el borde inferior del frame.
- Izquierda: `CONFIDENCIAL · {Operador} · {Fecha emisión}`
- Derecha: `Pág. {n}`
- Tipografía: Helvetica 7.5 pt, color `--ink-soft`.

---

## 3. Plantillas (PageTemplates)

| Template     | Cuándo se usa                          | Header/Footer        | Fondo            |
|--------------|----------------------------------------|----------------------|------------------|
| `cover`      | Página 1 únicamente                    | Banda dark + claim   | Full-bleed verde |
| `body`       | Páginas 2 a N-1                        | Estándar §2.1/§2.2   | Paper            |
| `validation` | Última página (obligatoria)            | Estándar             | Paper + card     |

> **Switch obligatorio:** insertar `NextPageTemplate("body")` **antes** del primer `PageBreak()` para evitar arrastrar la plantilla cover. Bug clásico documentado en v8.

### 3.1 Diseño de portada (cover)

```
┌─────────────────────────────────────────────────────┐  ← y = PAGE_H
│ ▌ Banda dark 14 mm                                  │
│   GEOCAPITALS · by Andes Dynamics    Mayo 2026      │
├─────────────────────────────────────────────────────┤
│                                                     │
│        [vacío — fondo PRIMARY_DK]                   │
│                                                     │
│        ▓ KICKER DORADO ▓                            │
│        ▓ Las Palmeras  (46 pt blanco)               │
│        ▓ Subtítulo descriptivo (12 pt crema)        │
│                                                     │
├══════ ribbon dorado 1.2 mm ════════════════════════┤  ← y = 0.55·H
│ ╲                                                   │
│   ╲     [diagonal — fondo PRIMARY más claro]        │
│     ╲                                               │
├───────╲────────────────────────────────────────────┤  ← y = 0.40·H
│         Operador           Inversiones Bioenergy    │
│         Concesión vigente  LAS ARENAS 1/25 · 125 ha │
│         Centroide AOI      −33.89880, −71.11367     │
│         Documento          Pre-NI 43-101 · v{n}     │
│         Confidencialidad   Distribución restringida │
└─────────────────────────────────────────────────────┘  ← y = 0
```

Parámetros exactos:
- Fondo full-bleed `c.rect(0, 0, PAGE_W, PAGE_H)` color `PRIMARY_DK`.
- Diagonal: polígono `(0, 0.55·H) → (W, 0.40·H) → (W, 0) → (0, 0)` en `PRIMARY`.
- Ribbon dorado: `c.rect(0, 0.55·H − 2mm, W, 1.2mm)` en `ACCENT`.
- Banda header 14 mm + ribbon dorado 0.8 mm bajo banda.
- Tabla meta: 5 filas, label en `ACCENT`, value en `white`, regla inferior `#1F4A40`.

---

## 4. Catálogo de componentes reutilizables

Todos los flowables viven en `src/lib/pdf/primitives.ts` (TS) y/o `/tmp/build_v*.py` (Python). Cada uno tiene un único responsable visual.

### 4.1 `HBand(kicker, title, color=PRIMARY_DK)`
Divisor de sección. Kicker dorado pequeño + título grande + regla bicolor (60 mm color, resto rule).

### 4.2 `KPICard(w, h, label, value, sub, color)` y `kpi_row(items)`
Cards con barra lateral `color` (1.6 mm), fondo `--card-bg`, label uppercase 7.5 pt, value 16 pt bold, sub 7.5 pt.
- Resumen ejecutivo: **2 filas de 4 cards** (8 KPIs totales).
- Indicadores económicos (Anexo B): 1 fila de 4.

### 4.3 `Callout(text, color=ACCENT)`
Sidebar de fondo `#FBF7EC` con barra lateral 1.6 mm. Para disclaimers usar `color=WARM`. Body 9 pt leading 12.5.

### 4.4 `commercial_table(header, rows, col_widths, header_color=PRIMARY_DK)`
- Header: fondo verde, texto blanco bold 8.5 pt, padding 6 pt.
- Cuerpo: zebra `#F4F2EC` en filas pares, padding 5 pt.
- **Crítico:** cada celda envuelta en `Paragraph` para word-wrap → evita solapamientos.
- `col_widths` debe sumar exactamente `CONTENT_W` (174 mm).

### 4.5 `Figure(path, caption)`
- `Image` ancho `CONTENT_W`, alto proporcional (60 % para mapas grandes, 32 % para bandas satelitales en grid 2×).
- Caption inmediatamente debajo: `Figura N.` en bold + texto en `S_SMALL`.

### 4.6 Mapas satelitales ESRI (Anexo A — anomalías)
A partir de **v10**, todos los mapas de anomalías del Anexo A se renderizan sobre **ESRI World Imagery** real (no sintético). Implementación canónica:

- **Librería:** `contextily` (`pip install contextily`) + `matplotlib`.
- **Proveedor:** `cx.providers.Esri.WorldImagery` (atribución obligatoria en caption).
- **Proyección:** convertir lon/lat WGS84 → Web Mercator (EPSG:3857) con helper `lonlat_to_merc(lon, lat)` antes de plotear. Nunca pasar grados directos.
- **Capas obligatorias por figura:**
  1. Basemap ESRI World Imagery (zoom 15–17 según extensión).
  2. Polígono AOI legal (`mining_concessions.geom`) con stroke `ACCENT` 1.2 pt, fill `none`.
  3. Marker de anomalía: círculo proporcional al `radius_m`, color por `mineral_code`, label `{code} · score {n}`.
  4. Norte + escala gráfica + atribución `Esri, Maxar, Earthstar Geographics`.
- **Salida:** PNG 300 dpi, ratio 4:3, guardado en `/tmp/v{n}_assets/anom_{code}_esri.png`.
- **Naming:** `anom_overview_esri.png` (todas las anomalías) + `anom_{A-XX}_esri.png` (detalle individual).
- **Estructura Anexo A v10+:**
  - **Figura A.1** — Overview ESRI con todas las anomalías + AOI + leyenda mineral.
  - **Figuras A.2 … A.(1+N)** — Detalle individual por anomalía (zoom, sensor, score, radio).
  - **Figura final** — Mapa de zonas Z1–Zn de campo sobre ESRI.
- **Descripción del Anexo A** (texto canónico bajo `HBand`): `Mapas satelitales ESRI · anomalías sobre AOI`.

---

## 5. Estructura canónica del informe

Orden **fijo y no negociable** para informes completos. Variantes en §12 indican qué secciones se omiten.

| #   | Sección                                          | Páginas | Componentes clave                          |
|-----|--------------------------------------------------|---------|--------------------------------------------|
| 01  | **Portada** (cover)                              | 1       | Cover template + meta table                |
| 02  | **Tabla de contenido** + marco regulatorio       | 1       | `commercial_table` + `Callout`             |
| 03  | **Resumen ejecutivo** (KPIs + tesis)             | 1       | `HBand` + 2 `kpi_row` + bullets            |
| 04  | **Contexto geológico y AOI**                     | 1       | `Figure(fig_aoi.png)` sobre ESRI           |
| 05  | **Catastro y concesiones**                       | 1       | Tabla concesiones + plano + vértices WGS84 |
| 06  | **Datos satelitales y bandas**                   | 1–2     | Tabla productos + grid 2×2 mini-mapas      |
| 07  | **Anomalías multiespectrales**                   | 1       | `commercial_table` (Cód · Nombre · Score)  |
| 08  | **Zonas de interés**                             | 1       | `Figure(fig_zonas.png)` + Tabla 4.1        |
| 09  | **Targets / Exploration Target conceptual**      | 1       | Tabla 4.2 + `Callout` warm (disclaimer §2.3)|
| 10  | **Estimación de recursos** *(NI 43-101 firmado)* | 1–2     | Tabla recursos Inferido/Indicado/Medido    |
| 11  | **Malla diamantina propuesta**                   | 1       | Tabla DDH (Hoyo · Anillo · Lat · Lon · …)  |
| 12  | **Pipeline F1 · F2 · F3 + CAPEX**                | 1       | `commercial_table` + total destacado       |
| 13  | **Conclusiones y próximos hitos**                | 1       | `HBand(color=ACCENT)` + bullets ▸          |
| 14  | **Anexo A · Mapas satelitales ESRI (anomalías)** | 3–5     | Overview ESRI + 1 figura ESRI por anomalía + zonas (ver §4.6) |
| 15  | **Anexo B · Concesión legal + plan minero**      | 1–2     | Ficha legal + tabla plan híbrido + KPIs eco|
| 16  | **Página de validación** *(obligatoria)*         | 1       | Logo + QR + clave pública (ver §8)         |

---

## 6. Plantillas de tablas (anchos fijos)

Todos los anchos en mm. Suma siempre `= 174 mm` (`CONTENT_W`).

### 6.1 Indicadores principales (resumen ejecutivo)
| Col          | Ancho |
|--------------|-------|
| Indicador    | 70    |
| Valor        | 104   |

### 6.2 Anomalías multiespectrales
| Cód | Nombre | Alteración | Score | Radio (m) | Sensor |
|-----|--------|------------|-------|-----------|--------|
| 14  | 42     | 42         | 14    | 18        | 44     |

### 6.3 Zonas de interés (4.1)
| Zona | Mineralización dominante | Anom. | Área (ha) | Score | Espesor (m) | Profund. (m) |
|------|---|---|---|---|---|---|
| 10   | 66 | 14 | 18 | 18 | 22 | 26 |

### 6.4 Exploration Target conceptual (4.2)
| Zona | Tonelaje (Mt) | Au (g/t) | Ag (g/t) | Cu (%) | Au cont. (oz) | Ag cont. (oz) |
|------|---|---|---|---|---|---|
| 12   | 24 | 22 | 22 | 22 | 32 | 40 |

### 6.5 Estimación de recursos (NI 43-101 firmado)
| Categoría | Tonelaje (kt) | Au (g/t) | Ag (g/t) | Au cont. (koz) | Ag cont. (koz) | Cut-off |
|-----------|---|---|---|---|---|---|
| 26 | 22 | 18 | 18 | 24 | 24 | 42 |

Categorías obligatorias: **Inferido**, **Indicado**, **Medido**, **M+I**, **M+I+I**.

### 6.6 Malla diamantina (DDH)
| Hoyo | Anillo | Prioridad | Lat | Lon | Prof (m) | Target |
|------|---|---|---|---|---|---|
| 36 | 20 | 16 | 22 | 22 | 14 | 44 |

### 6.7 Pipeline F1·F2·F3
| Fase | Actividad | Plazo | USD |
|------|---|---|---|
| 14 | 98 | 32 | 30 |

---

## 7. Datos canónicos — single source of truth

> **Regla de oro:** nunca hardcodear coordenadas, áreas, vértices ni KPIs en el builder. Todo se lee de la BD vía server function.

| Dato                       | Fuente canónica                                  | Notas |
|----------------------------|--------------------------------------------------|-------|
| Polígono legal             | `mining_concessions.geom` (PostGIS)              | `ST_AsGeoJSON` + `ST_Area(::geography)/10000` |
| Centroide                  | `ST_Centroid(geom)` sobre el polígono            | **No** usar `projects.center_lat/lng` (suele estar desactualizado) |
| AOI dashboard              | `src/data/geo/aoi.geojson`                       | Debe coincidir con polígono legal (regla de v8.1) |
| Anomalías satelitales      | `satellite_anomalies` + `ni43101_satellite_layers` | Score ∈ [0,100]; sensor obligatorio |
| Zonas de interés           | `alteration_zones`                               | mineral_dominante, espesor, profundidad |
| Exploration Targets        | `exploration_targets` / `satellite_targets`      | rango_min / rango_max obligatorios |
| Recursos                   | `block_models` + `mineral_deposits`              | Sólo NI 43-101 firmado |
| Malla DDH                  | `drill_collars`                                  | Az/dip/prof por hoyo |
| Catastro nacional          | `cadastre_national` / `mining_concessions`       | Estado vigente al día de emisión |

---

## 8. Página de validación (formato fijo, obligatorio)

Última página de **todo** informe Geocapitals. Estructura en 3 columnas (55 / 55 / 64 mm) dentro de un card `--card-bg`.

```
┌──────────────────────────────────────────────────────────┐
│  GEOCAPITALS         ┌─────────┐    METADATA              │
│  by Andes Dynamics   │   QR    │    Documento ID …        │
│                      │         │    Emisión …             │
│  Documento emitido   └─────────┘    Concesión …           │
│  por Inversiones …   Escanea …      Plan minero …         │
│                      verify URL     Confidencialidad …    │
└──────────────────────────────────────────────────────────┘

Clave pública institucional (Ed25519, fingerprint)
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAI… geocapitals-trackmin@2026
Fingerprint: SHA256: 4f:1a:3c:8b:90:de:21:55:7c:bb:44:e8:3a:09:7d:62

[ Callout: cómo validar en 4 pasos ]
```

### 8.1 QR validador
- **URL canónica:** `https://geocapitals.com/verify/{project.code}/v{n}`
  - Ej: `https://geocapitals.com/verify/TRK-ALH-001/v8`
- **Endpoint:** ruta pública `/api/public/verify/{code}/v{n}` que retorna:
  - SHA-256 del PDF emitido
  - Firma Ed25519 del hash
  - Metadata mínima (operador, fecha, versión, deprecación)
- **Snippet de generación:**
  ```python
  import qrcode
  qr = qrcode.QRCode(border=1, box_size=8)
  qr.add_data(f"https://geocapitals.com/verify/{code}/v{n}")
  qr.make(fit=True)
  qr.make_image(fill_color="#0A3F35", back_color="#FAFAF7").save(out)
  ```

### 8.2 Clave pública institucional
- **Algoritmo:** Ed25519.
- **Almacenamiento:** secret `GEOCAPITALS_SIGNING_PUBKEY` (renovación anual).
- **Fingerprint:** SHA-256 colon-separated, mostrado en mono Courier 8 pt.

### 8.3 Bloque metadata (orden fijo)
1. Documento ID — `{code}-v{n}`
2. Emisión — fecha humana
3. Concesión — nombre legal
4. Plan minero — etiqueta corta (Híbrido OP+UG, etc.)
5. Confidencialidad — Restringida / Pública / Investor

### 8.4 Instrucciones de validación (callout final)
> **Cómo validar.** 1) Escanea el QR superior — debe redirigir a `geocapitals.com/verify/{code}/v{n}`. 2) En el portal verás el hash SHA-256 de este PDF. 3) Compara dicho hash con el cálculo local (`shasum -a 256 {file}.pdf`). 4) Verifica la firma con la clave pública anterior.

---

## 9. Disclaimers normativos (texto exacto)

### 9.1 Marco regulatorio (toda portada/TOC)
> Este informe es un Pre-NI 43-101 de naturaleza conceptual exploratoria. Los Exploration Targets reportados en la sección 4 cumplen los lineamientos NI 43-101 §2.3 y CIM Definition Standards (2014) §14, y **no constituyen Recurso Mineral** hasta su confirmación por sondajes.

### 9.2 Disclaimer NI 43-101 §2.3 (bajo tabla 4.2)
> El Exploration Target aquí declarado es de naturaleza conceptual. La cantidad y ley son órdenes de magnitud y **no son suficientes para categorizarlas como Recurso Mineral**. Es incierto si exploración adicional resultará en la definición de un recurso mineral. La declaración cumple con los lineamientos CIM Definition Standards (2014) §14 y NI 43-101 §2.3 en cuanto a forma y propósito de divulgación.

### 9.3 Disclaimer técnico (cierre de informe)
> Informe Pre-NI 43-101 conceptual basado en interpretación satelital Sentinel-2 + ASTER, mapeo de superficie y geometría exploratoria proyectada. **No constituye PEA, PFS ni FS bajo NI 43-101.** Las cifras de zonas, tonelaje, leyes, malla, CAPEX y plazos son referenciales y se actualizarán tras la campaña geofísica y de sondajes Fase 1.

### 9.4 Disclaimer NI 43-101 firmado (sólo cuando hay QP)
> Recursos minerales clasificados según CIM Definition Standards (2014). Reporte firmado por {QP_Name}, {QP_Title}, miembro del {Professional_Body} en cumplimiento de NI 43-101 Form 43-101F1.

---

## 10. QA obligatorio antes de entregar

**No se entrega ningún PDF sin pasar este checklist.** El responsable es quien ejecuta el builder.

### 10.1 Render técnico
```bash
pdftoppm -r 150 -jpeg {Proyecto}_{Tipo}_v{n}.pdf /tmp/qa
# inspeccionar /tmp/qa-*.jpg página por página
```

### 10.2 Checklist visual (por página)
- [ ] Header dark band + ribbon dorado intactos
- [ ] Footer con paginación correcta y leyenda CONFIDENCIAL
- [ ] Sin texto solapado en celdas (especialmente Malla DDH y Anomalías)
- [ ] Sin texto cortado en bordes de tabla o página
- [ ] Sin glifos faltantes (cajas negras → fuente sin soporte: revisar `<sub>/<super>`)
- [ ] Contraste OK (no texto verde claro sobre crema)
- [ ] Figuras alineadas con caption inmediatamente debajo
- [ ] Tablas: header verde, zebra coherente, sin filas cortadas a mitad de página
- [ ] KPI cards con barras laterales del color correcto
- [ ] Página de validación con QR escaneable (verificar al menos una vez con cámara)

### 10.3 Checklist de datos
- [ ] Centroide del PDF = `ST_Centroid(mining_concessions.geom)` (4 decimales)
- [ ] Vértices del polígono coinciden con BD y con `aoi.geojson`
- [ ] Área en hectáreas calculada con `ST_Area(::geography)/10000`
- [ ] Versión del informe ≥ versión anterior
- [ ] Anexo B deprecación explícita de versiones anteriores

### 10.4 Comunicación post-QA
> Reportar al usuario: páginas inspeccionadas, issues encontrados, fixes aplicados. Nunca entregar diciendo "todo OK" sin haber abierto las imágenes.

---

## 11. Versionado y nomenclatura

### 11.1 Nombre de archivo
```
{Proyecto}_{TipoInforme}_v{n}.pdf
```
Ejemplos:
- `Las_Palmeras_PreNI43-101_v8.pdf`
- `Franco_NI43101_Firmado_v3.pdf`
- `Catastro_Mensual_2026-05_v1.pdf`

### 11.2 Bump de versión
- Cualquier cambio de datos numéricos, vértices, malla → **+1 versión**.
- Cambios sólo cosméticos (typo, redacción) → mantener versión y agregar `_revA`, `_revB`.

### 11.3 Deprecación
- Toda versión nueva debe **deprecar explícitamente** las anteriores en Anexo B con la frase:
  > "Toda la documentación previa emitida bajo {Proyecto} v1–v{n−1} queda formalmente reemplazada por el presente informe v{n}."

### 11.4 Trazabilidad
- Cada PDF emitido se almacena en `storage://reports/{org_id}/{project_id}/v{n}.pdf`.
- Hash SHA-256 + firma Ed25519 se persisten en `report_signatures` (tabla a crear si aún no existe).

---

## 12. Variantes por tipo de informe

| Tipo                       | Secciones incluidas                                  | Páginas típicas | Plantilla cover |
|----------------------------|------------------------------------------------------|-----------------|-----------------|
| **Pre-NI 43-101**          | 01 – 16 completo                                     | 14 – 18         | Verde estándar  |
| **NI 43-101 firmado (QP)** | 01 – 16 + sección 10 obligatoria + firma QP          | 30 – 60         | Verde estándar  |
| **Express satelital**      | 01, 02, 03, 04, 06, 07, 09, 13, 16                   | 4 – 6           | Verde estándar  |
| **Catastro mensual**       | 01, 02, 05, 13, 16                                   | 6 – 10          | Verde + acento warm |
| **Holder profile**         | 01, 02, 05 (concesiones del holder), 13, 16          | 4 – 8           | Verde estándar  |
| **Investor brief**         | 01, 02, 03, KPI hero, gráfico financiero, 13, 16     | 3 – 5           | Verde + sello "INVESTOR" |
| **Bulletin alert**         | 01 mini, alerta única, 16                            | 2               | Banner warm     |

> En todas las variantes la **página de validación (16) es obligatoria**.

---

## 13. Workflow del agente IA generador

1. **Leer esta guía** completa antes de generar.
2. **Consultar BD** para datos canónicos (§7) — nunca hardcodear.
3. **Renderizar figuras** previas (mapas) con builder dedicado (`build_band_maps.py` o equivalente TS).
4. **Construir PDF** usando `commercial_table`, `kpi_row`, `Callout`, `HBand` (§4).
5. **Bumpear versión** (§11.2) y deprecar anteriores (§11.3).
6. **QA visual obligatorio** (§10) — abrir cada página renderizada.
7. **Reportar al usuario** con: archivo generado, páginas verificadas, issues+fixes.
8. **Persistir hash + firma** en `report_signatures` y subir a storage.

---

## 14. Referencias

- **Builder de referencia (Python):** `/tmp/build_v8.py` (Las Palmeras Pre-NI 43-101 v8).
- **Pipeline TS:** `src/lib/pdf/primitives.ts`, `src/lib/pdf/sections.ts`, `src/lib/pdf/figures.ts`.
- **Captura de mapas:** `src/lib/pdf/captureMap.ts`, `src/lib/pdf/catastro-map.ts`.
- **Brief geológico:** `src/lib/pdf/geo-brief.ts`.
- **Holder profile:** `src/lib/pdf/holder-profile.ts`.
- **Mensual:** `src/lib/pdf/monthly-report.ts`.
- **Server functions PDF:** `src/lib/export-ni43101-pdf.ts`.
- **Memoria de proyecto:** `mem://plan/produccion-maestra`, `mem://plan/3d-ia-disruptivo`.

---

*Geocapitals · by Andes Dynamics · Trackmin GeoIntel — Documento normativo interno.*
