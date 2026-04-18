

## Refactor del PDF — Estilo NI 43-101

### Diagnóstico del PDF actual

El generador actual (`src/lib/export-pdf.ts`) usa **html2canvas para capturar cada tab** y pegar la imagen en el PDF. Resultado:
- 50+ páginas con texto cortado, tablas partidas, mapas borrosos
- Sin tabla de contenido, sin numeración de secciones, sin figuras numeradas
- Texto no es seleccionable (todo es bitmap)
- Encabezado "OVERVIEW/GEOLOGY/GEOPHYSICS" se repite por cada slice
- Layout de pantalla ≠ layout de informe técnico

### Solución: generador nativo con jsPDF + autoTable

Reemplazar **completamente** `src/lib/export-pdf.ts` por un generador estructurado que extrae los datos del proyecto (constantes en `src/routes/index.tsx`, hooks de Supabase) y los renderiza como informe NI 43-101 con texto vectorial, tablas reales y figuras numeradas.

### Estructura del nuevo informe (índice tipo Cornellana)

```text
PORTADA               — título, operador, QP, fecha, CVE-like ID
ÍNDICE DE CONTENIDO   — auto-generado con números de página
RESUMEN EJECUTIVO     — abstract 1 página
1. INTRODUCCIÓN
2. CONFIANZA EN OTROS EXPERTOS
3. LOCALIZACIÓN Y DESCRIPCIÓN DE LA PROPIEDAD
   3.1 Ubicación y accesos
   3.2 Descripción de la propiedad
   3.3 Tipos de derechos mineros (tabla pertenencias SERNAGEOMIN)
   3.4 Pertenencias intersectando AOI       ← reusa exportCatastroPdf
4. CLIMA, INFRAESTRUCTURA, GEOMORFOLOGÍA
5. HISTORIA DEL DISTRITO MINERO              ← labores antiguas
6. MARCO GEOLÓGICO
   6.1 Geología regional                    ← Fm. Lo Valle, distritos análogos
   6.2 Geología local                        ← litología, alteración, mineralogía
7. TIPO DE DEPÓSITO                          ← epitermal-mesotermal Au-Cu
   7.1 Mineralización
   7.2 Alteración hidrotermal
8. EXPLORACIÓN
   8.1 Levantamiento topográfico (AOI)
   8.2 Geofísica                            ← campañas Mag/IP/CSAMT desde Supabase
   8.3 Geoquímica / Muestreo                ← protocolo + QA/QC
9. PROGRAMA DE PERFORACIÓN                   ← 4 DDH, especificaciones
10. PREPARACIÓN, ANÁLISIS Y SEGURIDAD MUESTRA
11. VERIFICACIÓN DE DATOS
12. PRESUPUESTO Y CRONOGRAMA                 ← 4 fases USD 211K
13. CONCLUSIONES Y RECOMENDACIONES
14. REFERENCIAS BIBLIOGRÁFICAS
ANEXO A — Listado completo pertenencias
ANEXO B — Estaciones geofísicas
```

### Aproximación técnica

**Generador único:** `src/lib/export-ni43101-pdf.ts`

- **jsPDF A4 portrait** (no más landscape).
- **Texto vectorial** con `doc.text()` + word-wrap (`doc.splitTextToSize`). Seleccionable, indexable, peso ~10× menor.
- **`jspdf-autotable`** para todas las tablas (pertenencias, litología, sondajes, presupuesto, geofísica) — ya está instalado.
- **Mapas y figuras** capturados puntualmente con `html2canvas` solo para el componente `<ProjectMap>` y la cross-section, insertados como **Figura N** numeradas con caption (no tabs completos).
- **Numeración automática** de páginas, secciones, figuras y tablas con contadores.
- **TOC con dot-leaders** generada en segunda pasada (jsPDF soporta marcadores de página).
- **Header/footer minimalista**: arriba "TRACKMIN GeoIntel · TRK-ALH-001", abajo "Pág. X de Y · CONFIDENCIAL".
- **Portada profesional**: título grande, foto AOI (capturar mapa centrado a buena resolución), bloque de metadatos en tabla, firma del QP.
- **Datos extraídos directamente** desde:
  - Constantes en `src/routes/index.tsx` (PROJECT, fases, presupuesto)
  - `useGeologyData()` para litología/alteración
  - `useGeophysicsData()` para campañas
  - `loadCatastro()` para pertenencias (con intersección AOI vía turf)
  - GeoJSON locales (drill_collars, veins, workings)

### Archivos afectados

```text
NUEVO  src/lib/export-ni43101-pdf.ts       ← generador completo NI 43-101
NUEVO  src/lib/pdf/sections.ts              ← una función por sección §1-§14
NUEVO  src/lib/pdf/primitives.ts            ← header, footer, h1, h2, p, figure, toc
NUEVO  src/lib/pdf/captureMap.ts            ← captura solo del mapa Leaflet (alta res)
EDIT   src/routes/index.tsx                 ← TopNav.exportPdf llama al nuevo generador
DEL    src/lib/export-pdf.ts                ← obsoleto (capturas de tabs)
```

### Flujo del botón "Exportar PDF"

1. Usuario clickea **Exportar PDF** en TopNav.
2. Toast: "Generando informe NI 43-101…".
3. Carga lazy: `const { exportNI43101 } = await import("@/lib/export-ni43101-pdf")`.
4. Hace fetch puntual de pertenencias + geofísica + geología.
5. Captura mapa principal **una sola vez** a 2× DPR para Figura 1 (mapa de ubicación) y Figura 7 (geología regional).
6. Renderiza secciones secuencialmente (texto + tablas), inserta figuras donde corresponde.
7. Segunda pasada: completa números de página en el TOC.
8. `doc.save("TRK-ALH-001_Informe_NI43-101_<fecha>.pdf")`.

### Resultado esperado

- ~25-30 páginas (vs 50+ actuales)
- Texto seleccionable, tablas reales, figuras numeradas con caption
- Estructura 1:1 con norma NI 43-101 / referencia Cornellana
- Tamaño archivo ~1-2 MB (vs ~10 MB actual con bitmaps)
- Una sola captura de mapa de alta calidad, no slices borrosos

### Notas

- Se mantiene `exportCatastroPdf` actual sin tocar (botón separado en mapa).
- El nuevo PDF reusa la lógica turf de intersección AOI para Sección 3.4.
- Bibliografía: Hedenquist, Sillitoe, Corbett & Leach, Gómez-Gajardo 2024 (ya referenciados en código).

