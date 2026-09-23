/**
 * Tokens de marca para documentos PDF de Geocapitals.
 * Institutional Modernist: papel hueso, tinta, cobalto, serif display.
 * Todos los generadores de documentos deben consumir estos valores;
 * nunca colores sueltos dentro de las plantillas.
 */

export type RGB = [number, number, number];

export const GC_COLOR = {
  ink: [18, 22, 26] as RGB,
  inkSoft: [48, 54, 60] as RGB,
  paper: [245, 242, 236] as RGB,
  paperDeep: [236, 232, 223] as RGB,
  white: [255, 255, 255] as RGB,
  cobalt: [36, 71, 214] as RGB,
  cobaltSoft: [196, 208, 246] as RGB,
  slate: [110, 118, 126] as RGB,
  hairline: [227, 224, 216] as RGB,
  copper: [192, 112, 58] as RGB,
  gold: [200, 146, 42] as RGB,
  green: [42, 122, 84] as RGB,
} as const;

/** Familias tipográficas nativas de jsPDF usadas por la marca. */
export const GC_FONT = {
  /** Serif display para títulos y cifras protagonistas. */
  display: "times",
  /** Sans para cuerpo, tablas, etiquetas y pies. */
  body: "helvetica",
} as const;

export const GC_BRAND = {
  name: "GEOCAPITALS",
  tagline: "Plataforma de activos mineros e inversión",
  site: "geocapitals.com",
  email: "contacto@geocapitals.com",
  whatsapp: "+56 9 6218 4071",
} as const;

/** Formatos de página en puntos. */
export const GC_PAGE = {
  /** Deck apaisado 16:9 (misma proporción que una presentación). */
  deck: { w: 960, h: 540, m: 44 },
  /** A4 vertical. */
  a4: { w: 595.28, h: 841.89, m: 48 },
} as const;
