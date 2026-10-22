# Rediseño del sistema documental GeoCapitals (deck 16:9, ficha A4, informe técnico A4)

Solo planificación. En esta fase no se tocan SPVs, KYC, autenticación, base de datos, rondas ni condiciones comerciales. Los documentos públicos actuales siguen igual hasta que apruebes la vista previa.

## Lo que encontró la auditoría
- **Colores fuera de marca:** `institutional.ts` define IM_NAVY (13,43,62) e IM_GOLD (185,138,47). `visualInvestorSlides.ts` los usa en kickers, títulos, filos y fichas. `tokens.ts` tampoco coincide con la plataforma: tinta 18,22,26 en vez de #1A1A2E y cobalto 36,71,214 en vez de #2B4ACB.
- **Tipografía incompleta:** solo se incrustan Newsreader e IBM Plex Sans (Regular, SemiBold e Italic). Falta IBM Plex Mono, que la marca usa para folios, montos y coordenadas. Algunas notas salen en 5,6 pt, que no se leen bien impresas.
- **Imágenes repetidas:** `deck2026.ts` usa la foto hero ilustrativa 3 veces, la vista de la plataforma 2 veces y las pertenencias de Cholqui y de Los Verdes 2 veces cada una. Ningún mapa trae escala, norte, sistema de coordenadas ni atribución completa en la misma lámina.
- **Fichas con aspecto de app:** la ficha de inversión es una tarjeta navy con esquinas redondeadas y una barra dorada.
- **Exportadores paralelos:** hay 15 archivos fuera de `src/lib/pdf` que crean documentos por su cuenta (por ejemplo `exportSatelliteIntelPdf`, `export-ni43101-pdf`, `tilama-pdf`, `exportTargetsPDF`), varios con helvetica. Quedan fuera del alcance. Solo se inventarían y se agendaría su migración.
- **Discrepancias abiertas:** ronda Cholqui (USD 1,0 M en el sistema y USD 1,5 M en el dossier), mínimo de Los Verdes (USD 50.000 y USD 15.000) y Cu frente a Cu–Mo. Hoy solo se documentan y no frenan la generación del PDF.

## Dirección de diseño (estilo banca de inversión / consultora minera)
- Papel #F7F5F0, tinta #1A1A2E y cobalto #2B4ACB como único acento. Las líneas finas van en arena #E3E0D8. Se eliminan navy y oro.
- Newsreader para títulos y cifras clave, Plex Sans para el texto y Plex Mono para datos, folios y notas de fuente.
- Retícula de 12 columnas. Tablas vectoriales con línea solo arriba y abajo y cifras alineadas a la derecha en Plex Mono. Sin cajas redondeadas ni sombras.
- Tamaños mínimos: 7,5 pt para notas al pie y disclaimers, 9 pt para el texto del deck y 8,5 pt para el texto A4.
- Cada cifra lleva una marca de procedencia (OFICIAL, DECLARADO, MEDIDO, MODELADO, REFERENCIAL) con su nota numerada al pie de la página.

## Entregables
1. **Deck 16:9 editorial (10 láminas):** portada con imagen a sangre, tesis, estructura de la ronda, Cholqui, Los Verdes–Tilama, modelo, plataforma, valor y horizonte, colateral y cierre. Cada imagen aparece una sola vez: los mapas GIS reales van en las láminas de proyecto y las vistas ilustrativas llevan su rótulo. La ficha app se reemplaza por un bloque tipo term sheet con tabla vectorial.
2. **Ficha de inversión A4 (una por proyecto, 2 páginas):** pág. 1 con ubicación, mapa, términos y escenarios de valor referenciales; pág. 2 con plan de explotación, riesgos, fuentes y QR.
3. **Informe técnico A4:** el actual «Dossier Técnico Institucional» (`technicalBrief.ts`) con la nueva identidad: control documental, responsabilidad técnica, figuras GIS y una tabla de fuentes por dato.

## Implementación escalonada
**Fase 0. Bases (sin cambio visible)**
- `brand/tokens.ts`: alinear los valores con la paleta de la plataforma (#F7F5F0, #1A1A2E, #2B4ACB, #E3E0D8, #6B6B7B) y crear `GC_TYPE` con la escala de tamaños mínimos.
- `brand/kit.ts`: registrar IBM Plex Mono (Regular y SemiBold) en `ensureBrandFonts` y crear la familia `font(doc, "mono", …)`. Se agregan los TTF en `src/assets/fonts/pdf/`.
- `brand/institutional.ts`: mantener los alias IM_NAVY/IM_GOLD pero apuntarlos a tinta y cobalto, para no romper los otros documentos. La pleca pasa a tinta y cobalto. Se agregan helpers compartidos: `sourceNote(n, text)`, `provenanceTag`, `dataTable` (tabla vectorial con columnas numéricas), `mapFigure` (imagen + escala + norte + EPSG + atribución) y `footnotes(page)`.

**Fase 1. Modelo de procedencia y bloqueo de discrepancias**
- `pdf/model.ts`: tipo `SourcedValue { value, provenance, sourceId }` y un registro `sources[]` por documento.
- Nuevo `pdf/integrity.ts`: valida que cada cifra tenga su fuente y compara deck/ficha con los datos del sistema (`cholqui.ts`, `investor/fichas.ts`). Si hay discrepancia, la descarga pública se bloquea con un mensaje claro y la vista previa interna muestra un aviso. No se reconcilia nada en silencio: una lista `acknowledgedDiscrepancies` deja aprobar cada diferencia de forma explícita.

**Fase 2. Deck 16:9**
- Reescribir `templates/visualInvestorSlides.ts` con los nuevos helpers (columna editorial, term sheet tabular y notas numeradas en 7,5 pt).
- `features/marketing/deck/deck2026.ts`: cifras como `SourcedValue`, imágenes sin repetir y mapas con su metadato GIS, tomado de `cholqui_satellite_imagery.json` (bbox, EPSG:4326, atribución Esri).
- `investorDeck.ts`: sin bifurcar; la rama visual se mantiene, solo con la nueva estética.

**Fase 3. Ficha A4**
- Nuevo template `templates/investmentFicha.ts` dentro del mismo `generateProjectDoc` (nuevo `kind: "ficha"`), en reemplazo de `onePager.ts`. No se crea un exportador nuevo.

**Fase 4. Informe técnico A4**
- Restyling de `technicalBrief.ts` y `sections.ts` con `dataTable`, `mapFigure` y un anexo de fuentes. Se mantiene el aviso NI 43-101/JORC: sirve como estructura de revisión, no como certificación.

**Fase 5. Vista previa fidedigna y aprobación**
- Ruta interna solo para staff, `/dashboard/documentos/preview`, que dibuja el PDF real (blob en un iframe, sin captura HTML) para el deck, las 2 fichas y el informe, junto con el estado de integridad.
- La descarga pública de `/inversion/deck` sigue en la versión actual hasta que apruebes. El cambio se hace con una sola bandera (`DOC_SYSTEM_V3`).

## Pruebas
- **Vitest:**
  - las fuentes quedan incrustadas (Newsreader, Plex Sans y Plex Mono) y no aparecen helvetica ni times en el PDF;
  - no quedan colores navy ni oro en los operadores de color;
  - ningún texto mide menos de 7,5 pt;
  - toda cifra tiene `sourceId`;
  - una discrepancia sin aprobar bloquea la generación;
  - los términos comerciales siguen iguales: USD 1,5 M, 15.000 acciones a USD 100, mínimo USD 15.000, 47 %/65 % declarados y UF + 12 %.
- **Overflow:** prueba que mide cada bloque de texto contra su caja (splitTextToSize más la altura) y falla si se sale.
- **Visual:** script Python que genera los 3 documentos, los pasa a imagen con pdftoppm y revisa cada página (texto cortado, contraste, márgenes). Además, extracción de texto con pdfplumber para confirmar que el texto es vectorial y que están los disclaimers.
- **Navegador:** se actualiza `tests/marketing/investor_deck_browser.py` para revisar la descarga y la vista previa del staff.

## Riesgos
- Cambiar tokens compartidos afecta el contrato, la cartola, el certificado y el memo de colateral. Mitigación: alias de compatibilidad y revisión visual de esos PDFs en la Fase 0.
- El bloqueo por discrepancias detendrá el deck mientras sigan las diferencias de Cholqui y de Los Verdes. Necesito tu decisión: aprobar la diferencia o corregir la fuente.
- Las fuentes extra aumentan el peso del PDF (unos 300 KB). Mitigación: incluir solo los caracteres que se usan, si jsPDF lo permite.
- Para fotografías reales de faena no hay fotos verificadas disponibles. Se usarán solo mapas GIS e imágenes rotuladas como ilustrativas.
- Los 15 exportadores paralelos quedan pendientes y no se migran en este plan.

## Supuestos que debes confirmar
- La rentabilidad solo se muestra como escenarios referenciales ya declarados (valuaciones, venta USD 8 M, renta del 10 % y UF + 12 %), sin TIR inventada.
- Una ficha A4 por proyecto, en reemplazo del one-pager actual.
