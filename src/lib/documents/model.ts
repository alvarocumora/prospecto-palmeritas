// Modelo de documentos editables Geocapitals. Reutiliza el shape de bloques
// de tradeDocGen para poder pasarlos por el mismo renderer PDF con branding.

export type DocBlock =
  | { kind: "paragraph"; text: string }
  | { kind: "fields"; rows: Array<[string, string]> }
  | { kind: "table"; head: string[]; rows: string[][] }
  | { kind: "clauses"; items: string[] }
  | { kind: "signature"; parties: string[] };

export type GeneratedDoc = {
  docType: string;
  title: string;
  reference: string;
  date: string;
  blocks: DocBlock[];
};

export type FieldType = "text" | "textarea" | "number" | "date" | "select";

export type FieldDef = {
  key: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  options?: { value: string; label: string }[];
  default?: string;
  help?: string;
  group?: string;
};

export type ClauseDef = {
  key: string;
  label: string;
  text: string;
  defaultOn?: boolean;
};

export type TemplateCategory = "legal" | "inversion" | "trade";

export type TemplateDef = {
  id: string;
  title: string;
  shortTitle: string;
  acronym?: string;
  category: TemplateCategory;
  summary: string;
  fields: FieldDef[];
  clauses: ClauseDef[];
  /** Construye el modelo del documento a partir de los valores del formulario. */
  build: (
    values: Record<string, string>,
    activeClauses: Set<string>,
    ctx: { reference: string; date: string },
  ) => GeneratedDoc;
};
