// Identidad corporativa por defecto para los documentos de Geocapitals.
// Se precarga como "parte propia" en todas las plantillas del editor; el
// usuario puede editarla por documento.

export const OWN_COMPANY = {
  name: "Asesorías Terra SpA",
  rut: "77.333.862-0",
  representative: "Álvaro Cumora Oliva Herrera",
} as const;

/** Línea completa de la parte propia para campos y bloques de firma. */
export const OWN_PARTY_LINE = `${OWN_COMPANY.name} · RUT ${OWN_COMPANY.rut} · Rep. legal: ${OWN_COMPANY.representative}`;

// Operador de la plataforma: Geocapitals estructura y opera cada deal (la parte
// legal firmante sigue siendo OWN_COMPANY). Sello de operación en trades,
// portal de contraparte y documentos.
export const OPERATOR = "Geocapitals";
export const OPERATOR_LINE = `Operado por ${OPERATOR}`;
