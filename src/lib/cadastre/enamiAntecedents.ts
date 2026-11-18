// Pertenencias eliminadas con antecedentes de entrega a ENAMI aportados por el usuario.
// Ubicación: punto medio de la mensura (UTM 19S WGS84) del catastro SERNAGEOMIN.
export type EnamiAntecedent = { name: string; rol: string; e: number; n: number; detail: string; source: string };

export const ENAMI_ANTECEDENTS: EnamiAntecedent[] = [
  { name: "EL ZORRO 1/20", rol: "043030769-K", e: 297400, n: 6454075, detail: "Lote 803137: Cu 18,75 %, Ag 49 g/t, Au 3,10 g/t", source: "Certificado ENAMI Ventanas, 17-mar-2008" },
  { name: "M TILAMA NORTE 1/20", rol: "043030708-8", e: 300300, n: 6453175, detail: "11 certificados, 515 t secas, 2,58 % Cu soluble", source: "Liquidaciones ENAMI Cabildo (N.º 5015)" },
];
