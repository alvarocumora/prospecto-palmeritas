// Tribunal sugerido para escritos mineros según comuna. Tabla CONSERVADORA:
// solo comunas donde la jurisdicción del Juzgado de Letras es conocida; el resto
// cae en "[TRIBUNAL COMPETENTE]". Siempre debe verificarse en la OJV antes de presentar.

const norm = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

/** comuna (normalizada) → sede del Juzgado de Letras */
const SEDE: Record<string, string> = {
  melipilla: "Melipilla", "san pedro": "Melipilla", alhue: "Melipilla", "maria pinto": "Melipilla",
  illapel: "Illapel", salamanca: "Illapel",
  "los vilos": "Los Vilos",
  ovalle: "Ovalle", combarbala: "Combarbalá", andacollo: "Andacollo", vicuna: "Vicuña",
  "la serena": "La Serena", coquimbo: "Coquimbo",
  copiapo: "Copiapó", vallenar: "Vallenar", freirina: "Freirina", caldera: "Caldera",
  chanaral: "Chañaral", "diego de almagro": "Diego de Almagro",
  antofagasta: "Antofagasta", calama: "Calama", taltal: "Taltal", tocopilla: "Tocopilla",
};

export type TribunalSuggestion = { tribunal: string; known: boolean };

export function suggestTribunal(comuna: string | null | undefined): TribunalSuggestion {
  const sede = comuna ? SEDE[norm(comuna)] : undefined;
  if (!sede) return { tribunal: "[TRIBUNAL COMPETENTE]", known: false };
  return { tribunal: `Juzgado de Letras de ${sede}`, known: true };
}
