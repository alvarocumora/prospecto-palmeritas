## Objetivo

Crear `docs/report-generation-guide.md` — guía maestra y única fuente de verdad para generar **todos** los informes de Geocapitals (NI 43-101, satelital, catastro, targets, recursos, mensual, etc.) bajo el formato comercial **"Geocapitals by Andes Dynamics"**, con la misma identidad visual que la v8 de Las Palmeras.

## Ubicación

`docs/report-generation-guide.md` (nuevo archivo, ~600 líneas). Es documentación, no código — sirve tanto al builder Python (`/tmp/build_v*.py`) como al pipeline TS (`src/lib/pdf/*`).

## Estructura del documento

```text
1.  Identidad de marca
    - Logo, claim "by Andes Dynamics", paleta oklch + hex,
      tipografía (Helvetica Bold/Regular + monoespaciada para hashes)
2.  Sistema de página A4
    - Márgenes 18/18/30/22 mm, header dark band 14 mm + gold rule 0.8 mm,
      footer con regla + paginación + leyenda CONFIDENCIAL
3.  Plantillas (PageTemplates)
    - cover (full-bleed verde + diagonal + ribbon dorado)
    - body (header/footer estándar)
    - validation (último página obligatoria)
4.  Catálogo de componentes reutilizables
    - HBand (kicker dorado + título + regla bicolor)
    - KPICard + kpi_row (cards con barra lateral)
    - Callout (sidebar con barra dorada/warm)
    - commercial_table (header verde, zebra, paragraph-wrap)
    - Figure + caption (Image + Paragraph small)
5.  Estructura canónica del informe (orden fijo)
    01. Portada
    02. Tabla de contenido + marco regulatorio
    03. Resumen ejecutivo (KPIs + tesis de inversión)
    04. Contexto geológico y AOI (Figura 1 sobre ESRI)
    05. Catastro y concesiones (polígono legal + vértices WGS84)
    06. Datos satelitales y bandas (Sentinel-2 + ASTER + magnetometría)
    07. Anomalías multiespectrales (tabla score/radio/sensor)
    08. Zonas de interés (Z1-Zn con mineralización dominante)
    09. Targets / Exploration Target conceptual (tonelaje + leyes)
    10. Estimación de recursos (cuando aplique: Inferido/Indicado/Medido)
    11. Malla diamantina propuesta (tabla DDH completa)
    12. Pipeline F1·F2·F3 + CAPEX
    13. Conclusiones y próximos hitos
    14. Anexo A · Mapas geofísicos y bandas
    15. Anexo B · Concesión legal + plan minero
    16. Página de validación (logo + QR + clave pública)
6.  Plantillas de tablas (con anchos en mm)
    - Indicadores principales, Anomalías, Zonas, Exploration Target,
      Recursos NI 43-101, Malla DDH, Pipeline
7.  Datos canónicos (single source of truth)
    - Polígono legal: BD `mining_concessions` (no hardcodear)
    - Centroide: calcular sobre el polígono, no usar projects.center_lat/lng
    - Anomalías: BD `satellite_anomalies`
    - Targets: BD `exploration_targets` / `satellite_targets`
8.  Página de validación (obligatoria, formato fijo)
    - Logo Geocapitals + claim "by Andes Dynamics"
    - QR a `https://geocapitals.com/verify/{code}/v{n}`
    - Clave pública Ed25519 + fingerprint SHA256
    - Bloque metadata (ID, emisión, concesión, confidencialidad)
    - Instrucciones de validación en 4 pasos
9.  Disclaimers normativos (texto exacto a copiar)
    - NI 43-101 §2.3 (Exploration Target conceptual)
    - CIM Definition Standards (2014) §14
    - Disclaimer técnico Pre-NI 43-101
10. QA obligatorio antes de entregar
    - pdftoppm + revisión visual de cada página
    - Checklist: solapamientos, márgenes, footer, contraste
11. Versionado y nomenclatura
    - `{Proyecto}_{TipoInforme}_v{n}.pdf`
    - Bump de versión + deprecación explícita en Anexo B
12. Variantes por tipo de informe
    - Pre-NI 43-101 (Las Palmeras v8 = referencia)
    - NI 43-101 firmado por QP
    - Express satelital (3-4 págs, sin Anexo B)
    - Catastro mensual / Bulletin
    - Holder profile / investor brief
```

## Detalles técnicos

- **Paleta exacta** documentada en hex y oklch:
  `--ink #0B1320`, `--primary #0E5F4F`, `--primary-dk #0A3F35`,
  `--accent #C8A24A`, `--warm #B5532A`, `--paper #FAFAF7`, `--card-bg #F2EFE7`
- **Diseño de portada** descrito como ASCII wireframe + parámetros:
  full-bleed `PRIMARY_DK`, diagonal a 55%/40% en `PRIMARY`,
  ribbon dorado 1.2 mm, header band 14 mm con claim "by Andes Dynamics"
- **QR validador**: snippet de código (Python `qrcode` lib) + URL canónica
- **Tablas comerciales**: cada celda envuelta en `Paragraph` para evitar solapamientos; anchos calculados sobre `CONTENT_W = 174 mm`
- **Referencias cruzadas**: enlaces al builder de referencia (`/tmp/build_v8.py`) y a `src/lib/pdf/primitives.ts`

## Entregable

Un único archivo Markdown listo para ser leído por:
- el agente IA cuando regenere informes
- diseñadores que actualicen plantillas
- el QP que firme NI 43-101

Sin cambios de código en esta entrega — sólo el `.md`.