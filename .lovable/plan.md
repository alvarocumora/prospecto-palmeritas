# Rediseño PDFs de transacción · Identidad única Geocapitals

Objetivo: que todo documento generado (NDA, SPA, NDI, MoU, LOI, IM, etc.) comparta la misma identidad visual de la landing/plataforma (Institutional Modernist) y que el bloque de firma con sello del emisor funcione correctamente.

## Problemas detectados en el PDF adjunto

1. **Nombres de las partes se superponen** en el bloque de firma (slot izquierdo escupe "Álvaro Cumora" encima del slot derecho "Marcela Cimino \ Vincent Carpio"). Causa: `partyLines` usa `splitTextToSize(party, slotW)` pero luego pinta con `pdf.text(partyLines.slice(0, 2), x, y+14)` sin respetar el ancho — jsPDF ignora el wrap en la segunda pasada y una razón social larga desborda al slot vecino.
2. **QR de validación no aparece** en cabecera (sólo se ve la banda ink+oro y el título). El bloque `qrDataUrl` se dibuja pero queda tapado por el título largo; además el ancho reservado para el título (`contentW - 110`) no descuenta el QR real (72 + margen).
3. **Sello de firma electrónica del emisor no se aplica**: la tabla "Firmado electrónicamente por / Fecha / Hash" que aparece al pie viene de un bloque `fields` de la plantilla — el `emitterSignature` no llegó al renderer (o partyIndex quedó fuera de rango). Debe verse el nombre en cursiva sobre la línea + sello "FIRMADO · Geocapitals".
4. **Paleta no coincide con landing**: se usa oro (#CEA84C) + ink puro. La identidad institucional del sitio es papel hueso (#F7F5F0), tinta azulada (#1A1A2E) y **cobalto (#2B4ACB)** como acento — no oro.
5. **Faltan datos de contacto** (email y WhatsApp +56 9 6218 4071) que el usuario pidió previamente para todos los recursos generados.
6. **Numeración de cláusulas salta** (1,2,3,4,5,6,**8**) — es un bug de plantilla NDA que debe corregirse.

## Alcance del cambio

### 1. Sistema de tokens del PDF (`src/lib/documents/pdf.ts`)

Reemplazar constantes `GOLD/INK/MUTED/HAIRLINE` por una paleta alineada a `styles.css`:

```
PAPER      #F7F5F0   fondo cálido
PAPER_2    #EFEBE1   panel secundario
INK        #1A1A2E   texto principal / bandas
INK_SOFT   #4A4A5E   texto secundario
GRAY       #6B6B7B   hints / footer
COBALT     #2B4ACB   acento (líneas, sello, QR label)
COBALT_DP  #223CA6   hover/deep (bordes de sello)
HAIRLINE   #D9D4C7   líneas divisorias sobre papel
```

- Pintar fondo de página con `PAPER` (rect full-bleed) en cada `addPage`.
- Banda superior en `INK` con hairline `COBALT` (reemplaza la banda oro).
- Todas las líneas divisorias en `HAIRLINE`, acentos (subrayado de título, viñetas, sello) en `COBALT`.

### 2. Cabecera institucional editorial

- Logo mark 42pt + wordmark "GEOCAPITALS" en Helvetica bold + tagline "Mining Intelligence · Deals · Documentation".
- A la derecha: `Ref` (bold ink), fecha en gris, y **QR de validación** (56pt) con etiqueta "VALIDAR · geocapitals.com/verificar" en cobalto — se reserva ese ancho explícitamente para que el título no lo pise.
- Título con subrayado cobalto 2pt, tamaño 20pt.

### 3. Bloque de firma (fix del bug de solape)

- Calcular el ancho del slot y **envolver el nombre de la parte con `splitTextToSize` y renderizar línea a línea con `y` incremental** (no `slice(0,2)` sobre un array ya wrapped que igual desborda).
- Limitar a 3 líneas por slot con elipsis.
- Para el emisor (party 0 por defecto): dibujar nombre en cursiva 14pt centrado sobre la línea + sello redondeado (cobalto) "FIRMADO ELECTRÓNICAMENTE · GEOCAPITALS" con timestamp UTC + hash corto debajo.
- Añadir espacio superior (`y += 44`) para que la cursiva no pise el párrafo anterior.

### 4. Pie institucional con contacto

Reemplazar el disclaimer plano por un pie de dos columnas:

```
[hairline cobalto]
GEOCAPITALS · Mining Intelligence      contacto@geocapitals.com
Documento borrador editable · No       WhatsApp +56 9 6218 4071
constituye asesoría legal ni oferta.   geocapitals.com/verificar/{ref}
                                                        Página X / Y
```

Mini-QR (30pt) en esquina inferior derecha sólo en la última página.

### 5. Corrección de plantillas (`src/lib/documents/templates.ts`)

- Renumerar cláusulas del NDA para eliminar el salto 6→8.
- Verificar que cada plantilla (NDA, SPA, NDI, MoU, LOI, IM, Term Sheet, Data Room Access, Advance Request) tenga:
  - `signature` block con `parties` normalizadas (razón social + representante en la misma línea con separador tipográfico "·", no "").
  - Sin bloque `fields` duplicado al final tipo "Firmado electrónicamente por…" (esa metadata ahora la pinta el sello del emisor, no la plantilla).

### 6. Sello del emisor siempre presente

En `src/features/documents/DocumentEditor.tsx`:

- Verificar que `emitterSignature.partyIndex` corresponda a la parte "Divulgante/Vendedor/Emisor" según el docType (mapa por tipo).
- Fallback: si el usuario logueado coincide con alguna party por email/nombre, usar ese índice; si no, party 0.
- Pasar siempre `email`, `signedAt`, `hash`, `name`.

### 7. Verificación

- Regenerar NDA de prueba y renderizar a JPEG con `pdftoppm` para inspeccionar visualmente (no debe haber solape, QR debe verse, sello cursivo debe estar sobre la línea, paleta papel/cobalto).
- Regenerar SPA y MoU para confirmar que la identidad se aplica uniforme a todos los tipos.
- Confirmar que la ruta `/verificar/:ref` sigue resolviendo desde el QR. QR Mostrar Validacion al escanear en telefono o dispositivo 

## Archivos a modificar

- `src/lib/documents/pdf.ts` — nueva paleta, cabecera, bloque de firma sin solape, pie con contacto, fondo papel.
- `src/lib/documents/templates.ts` — renumerar NDA, normalizar `parties`, quitar duplicados de metadata firma.
- `src/features/documents/DocumentEditor.tsx` — asegurar `emitterSignature.partyIndex` correcto por tipo.
- (Sin cambios en `model.ts`, `signing.functions.ts`, ni en rutas.)

## Fuera de alcance

- No se toca el flujo de firma remota (`/firmar/:token`) ni la RPC `verify_document`.
- No se cambian tokens de `src/styles.css` (sólo se replican los mismos valores en constantes del renderer PDF, ya que jsPDF no lee CSS).
- No se rediseñan las páginas de la plataforma.