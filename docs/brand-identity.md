# Geocapitals — Identidad visual unificada

Sistema único: **Institutional Modernist**. Cruce entre banca privada suiza y prensa financiera de autoridad. Nada de estética SaaS/IA genérica.

## 1. Principios
- Autoridad sobre decoración: hairlines, cuadrícula editorial, mucho aire.
- Un solo acento de marca (cobalto). Sin degradados de colores, sin neón.
- Datos reales o nada: no se muestran ceros ni cifras sintéticas.
- Distinguir siempre: hecho medido · declarado · modelado · hipótesis · escenario.

## 2. Tipografía
| Rol | Fuente | Uso |
|---|---|---|
| Display | Newsreader (serif) | Titulares, portadas, cifras clave |
| Cuerpo | IBM Plex Sans | Texto, tablas, botones |
| Datos | IBM Plex Mono | Coordenadas, folios, montos, etiquetas en mayúsculas espaciadas |

PDFs: siempre `ensureBrandFonts(doc)` (fuentes incrustadas, nunca helvetica/times).

## 3. Color (tokens semánticos, nunca hex en componentes)
| Token | Referencia | Uso |
|---|---|---|
| `surface` | Papel hueso #F7F5F0 | Fondo |
| `surface-2` | #EFECE4 | Bandas, hover |
| `content` | Tinta #1A1A2E | Texto, bloques oscuros (hero) |
| `content-muted` | Gris cálido #6B6B7B | Texto secundario |
| `hairline` | Arena #E3E0D8 | Líneas y bordes |
| `accent-brand` | Cobalto #2B4ACB | Único acento |

Pantallas oscuras heredadas: envolver con `data-theme="im-light"`; no crear estilos nuevos.

## 4. Imágenes
- Satelital real (Esri / Sentinel / Copernicus) etiquetada **"Imagen real"**.
- Material comercial o generado etiquetado **"Referencial / ilustrativa"**.
- Hero: fotografía de terreno con velo de tinta y retícula de 64 px al 12 %.

## 5. Componentes
- Botón primario: tinta sólido, mayúsculas 11 px, tracking 0.2em, radio mínimo.
- Tarjetas: borde hairline, hover en borde cobalto, imagen superior con zoom lento.
- Etiquetas: mono 10 px, mayúsculas, tracking 0.2em.

## 6. Documentos (PDF)
Estructura única de `src/lib/pdf/brand/institutional.ts`: pleca tricolor, membrete con referencia/versión/fecha, secciones numeradas, sello QR pequeño con `publicUrl()`, advertencias legales (Ley N° 18.045, NCG 336).
