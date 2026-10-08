/**
 * Fuente única del proyecto Nahuelbuta REE / Paños Arcillas.
 * Origen: "Propuesta preliminar de paños mineros Arcillas 1 a 34" e informe
 * técnico NHB-TR-2026-001 (Inversiones Bioenergy SpA, 7-oct-2026).
 * Procedencia: DECLARADO (solicitudes / propuesta). Sin perforaciones,
 * sin recursos ni reservas. No inventar cifras aquí.
 */
export const NAHUELBUTA = {
  code: "NHB-REE",
  name: "Nahuelbuta REE · Paños Arcillas",
  commodity: "REE (arcillas iónicas)",
  region: "Arauco · Biobío / Malleco · La Araucanía",
  country: "Chile",
  stage: "Prospección temprana (TRL 1-2)",
  owner: "Inversiones Bioenergy SpA",
  reportRef: "NHB-TR-2026-001",
  reportDate: "7 de octubre de 2026",
  qp: { name: "Enrique Viteri Aldunate", email: "enriqueviteri@gmail.com", phone: "+56 9 82896199" },
  center: { lat: -37.64, lng: -73.2 },
  liveUrl: "/terminal/nahuelbuta",
  datumEscrito: "PSAD56 · UTM huso 18 Sur",
  panos: 34,
  haPorPano: 300,
  haPanos: 10_200,
  pedimentosNi: [
    { code: "P-01", area: "Malleco", ha: 2500, lat: "37°55'S", lng: "73°30'O" },
    { code: "P-02", area: "Arauco", ha: 2500, lat: "38°15'S", lng: "73°20'O" },
  ],
  geology: [
    "Basamento: Complejo Metamórfico Nahuelbuta (CMN) y granitoides asociados.",
    "Cobertura de saprolito caolinita-halloisita de 5 a 20 m (descrita en el informe).",
    "Modelo exploratorio: REE de adsorción iónica, análogo geoestructural al depósito NovaStar (Aclara Resources), ~45 km al norte.",
    "Anomalías de minerales de arcilla (CMI, bandas B6/B7 Landsat-9) en zonas de 800 a 1.200 ha — interpretación remota, no ley.",
  ],
  fase1: {
    budgetUsd: 380_000,
    months: 18,
    start: "4T 2026",
    items: [
      "Cartografía geológica de detalle",
      "Muestreo superficial de saprolito (TREO, % HREE)",
      "Geofísica aérea VTEM con líneas cada 200 m",
    ],
  },
  milestones: [
    { when: "2T 2026", what: "Pedimentos presentados ante SERNAGEOMIN" },
    { when: "4T 2026", what: "Otorgamiento previsto e inicio de Fase 1" },
    { when: "2028", what: "Cierre de Fase 1 (18 meses) y decisión de perforación" },
  ],
  gaps: [
    "Sin muestras de laboratorio: no hay ley de TREO medida en el área.",
    "Pedimentos en trámite: la tenencia no está constituida.",
    "Estudio de títulos y superposición con concesiones vecinas pendiente.",
    "Consulta territorial e indígena (Convenio 169 OIT) no iniciada.",
    "Las anomalías espectrales indican arcillas, no tierras raras.",
  ],
  caveats: [
    "Documento informativo: no constituye oferta pública de valores (Ley N° 18.045 / NCG 336).",
    "Proyecto en prospección temprana: no existen recursos ni reservas bajo NI 43-101 ni CH 20235.",
    "Los paños Arcillas son una propuesta preliminar de solicitud; su constitución depende de SERNAGEOMIN y los tribunales.",
    "La analogía con NovaStar es geológica, no implica ley ni tonelaje comparables.",
  ],
} as const;

export type PanoArcillas = {
  n: number;
  pmNorte: number;
  pmEste: number;
  comuna: string;
  provincia: string;
  region: string;
  tribunal: string;
};

/** Puntos medios de los 34 paños (PSAD56 UTM 18S) y tribunal competente. */
export const PANOS_ARCILLAS: PanoArcillas[] = [
  { n: 1, pmNorte: 5835900, pmEste: 650000, comuna: "Los Álamos", provincia: "Arauco", region: "Biobío", tribunal: "Juzgado de Letras y Garantía de Lebu" },
  { n: 2, pmNorte: 5834900, pmEste: 650500, comuna: "Los Álamos", provincia: "Arauco", region: "Biobío", tribunal: "Juzgado de Letras y Garantía de Lebu" },
  { n: 3, pmNorte: 5833900, pmEste: 650500, comuna: "Los Álamos", provincia: "Arauco", region: "Biobío", tribunal: "Juzgado de Letras y Garantía de Lebu" },
  { n: 4, pmNorte: 5832900, pmEste: 650500, comuna: "Los Álamos", provincia: "Arauco", region: "Biobío", tribunal: "Juzgado de Letras y Garantía de Lebu" },
  { n: 5, pmNorte: 5831900, pmEste: 650500, comuna: "Los Álamos", provincia: "Arauco", region: "Biobío", tribunal: "Juzgado de Letras y Garantía de Lebu" },
  { n: 6, pmNorte: 5829900, pmEste: 650500, comuna: "Los Álamos", provincia: "Arauco", region: "Biobío", tribunal: "Juzgado de Letras y Garantía de Lebu" },
  { n: 7, pmNorte: 5829900, pmEste: 651500, comuna: "Los Álamos", provincia: "Arauco", region: "Biobío", tribunal: "Juzgado de Letras y Garantía de Lebu" },
  { n: 8, pmNorte: 5834576, pmEste: 653500, comuna: "Los Álamos", provincia: "Arauco", region: "Biobío", tribunal: "Juzgado de Letras y Garantía de Lebu" },
  { n: 9, pmNorte: 5832576, pmEste: 652500, comuna: "Los Álamos", provincia: "Arauco", region: "Biobío", tribunal: "Juzgado de Letras y Garantía de Lebu" },
  { n: 10, pmNorte: 5832576, pmEste: 653500, comuna: "Los Álamos", provincia: "Arauco", region: "Biobío", tribunal: "Juzgado de Letras y Garantía de Lebu" },
  { n: 11, pmNorte: 5832576, pmEste: 654500, comuna: "Los Álamos", provincia: "Arauco", region: "Biobío", tribunal: "Juzgado de Letras y Garantía de Lebu" },
  { n: 12, pmNorte: 5830576, pmEste: 653500, comuna: "Los Álamos", provincia: "Arauco", region: "Biobío", tribunal: "Juzgado de Letras y Garantía de Lebu" },
  { n: 13, pmNorte: 5829576, pmEste: 653500, comuna: "Los Álamos", provincia: "Arauco", region: "Biobío", tribunal: "Juzgado de Letras y Garantía de Lebu" },
  { n: 14, pmNorte: 5828576, pmEste: 653500, comuna: "Los Álamos", provincia: "Arauco", region: "Biobío", tribunal: "Juzgado de Letras y Garantía de Lebu" },
  { n: 15, pmNorte: 5837900, pmEste: 656500, comuna: "Curanilahue", provincia: "Arauco", region: "Biobío", tribunal: "Juzgado de Letras y Garantía de Curanilahue" },
  { n: 16, pmNorte: 5836900, pmEste: 656500, comuna: "Los Álamos", provincia: "Arauco", region: "Biobío", tribunal: "Juzgado de Letras y Garantía de Lebu" },
  { n: 17, pmNorte: 5835900, pmEste: 656500, comuna: "Los Álamos", provincia: "Arauco", region: "Biobío", tribunal: "Juzgado de Letras y Garantía de Lebu" },
  { n: 18, pmNorte: 5834900, pmEste: 656500, comuna: "Los Álamos", provincia: "Arauco", region: "Biobío", tribunal: "Juzgado de Letras y Garantía de Lebu" },
  { n: 19, pmNorte: 5833900, pmEste: 656500, comuna: "Los Álamos", provincia: "Arauco", region: "Biobío", tribunal: "Juzgado de Letras y Garantía de Lebu" },
  { n: 20, pmNorte: 5832900, pmEste: 656500, comuna: "Los Álamos", provincia: "Arauco", region: "Biobío", tribunal: "Juzgado de Letras y Garantía de Lebu" },
  { n: 21, pmNorte: 5831900, pmEste: 656500, comuna: "Los Álamos", provincia: "Arauco", region: "Biobío", tribunal: "Juzgado de Letras y Garantía de Lebu" },
  { n: 22, pmNorte: 5830900, pmEste: 656500, comuna: "Los Álamos", provincia: "Arauco", region: "Biobío", tribunal: "Juzgado de Letras y Garantía de Lebu" },
  { n: 23, pmNorte: 5829900, pmEste: 656500, comuna: "Los Álamos", provincia: "Arauco", region: "Biobío", tribunal: "Juzgado de Letras y Garantía de Lebu" },
  { n: 24, pmNorte: 5828900, pmEste: 656500, comuna: "Los Álamos", provincia: "Arauco", region: "Biobío", tribunal: "Juzgado de Letras y Garantía de Lebu" },
  { n: 25, pmNorte: 5831900, pmEste: 659500, comuna: "Los Álamos", provincia: "Arauco", region: "Biobío", tribunal: "Juzgado de Letras y Garantía de Lebu" },
  { n: 26, pmNorte: 5830900, pmEste: 659500, comuna: "Los Álamos", provincia: "Arauco", region: "Biobío", tribunal: "Juzgado de Letras y Garantía de Lebu" },
  { n: 27, pmNorte: 5829900, pmEste: 659500, comuna: "Los Álamos", provincia: "Arauco", region: "Biobío", tribunal: "Juzgado de Letras y Garantía de Lebu" },
  { n: 28, pmNorte: 5828900, pmEste: 659500, comuna: "Los Álamos", provincia: "Arauco", region: "Biobío", tribunal: "Juzgado de Letras y Garantía de Lebu" },
  { n: 29, pmNorte: 5828900, pmEste: 662500, comuna: "Los Álamos", provincia: "Arauco", region: "Biobío", tribunal: "Juzgado de Letras y Garantía de Lebu" },
  { n: 30, pmNorte: 5828900, pmEste: 665500, comuna: "Curanilahue", provincia: "Arauco", region: "Biobío", tribunal: "Juzgado de Letras y Garantía de Curanilahue" },
  { n: 31, pmNorte: 5828900, pmEste: 668500, comuna: "Curanilahue", provincia: "Arauco", region: "Biobío", tribunal: "Juzgado de Letras y Garantía de Curanilahue" },
  { n: 32, pmNorte: 5827900, pmEste: 662500, comuna: "Los Álamos", provincia: "Arauco", region: "Biobío", tribunal: "Juzgado de Letras y Garantía de Lebu" },
  { n: 33, pmNorte: 5827900, pmEste: 665500, comuna: "Los Álamos", provincia: "Arauco", region: "Biobío", tribunal: "Juzgado de Letras y Garantía de Lebu" },
  { n: 34, pmNorte: 5827900, pmEste: 668500, comuna: "Angol", provincia: "Malleco", region: "La Araucanía", tribunal: "Juzgado de Letras de Angol" },];
