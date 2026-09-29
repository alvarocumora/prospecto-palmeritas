# GeoCapitals Narrative Engine · REPORT-02

## Propósito

REPORT-02 cambia el motor documental desde una composición dominada por tablas hacia una estructura narrative-first. El objetivo es que el cuerpo principal de un informe técnico explique la evidencia, su procedencia, la interpretación y las brechas; los listados extensos pasan a anexos.

## Bloques canónicos

- `narrative`: explicación técnica sustentada.
- `finding`: conclusión o lectura material, siempre distinguida de la observación.
- `evidence`: evidencia con clase de procedencia, confianza y fuente.
- `figure`: figura raster o captura con pie y procedencia.
- `map`: figura cartográfica con CRS, imagery y fuente.
- `gap`: brecha de información explícita.
- `recommendation`: acción propuesta, separada de la evidencia.
- `appendixTable`: tabla extensa destinada al anexo.

Los bloques heredados `text`, `bullets`, `kv` y `table` se mantienen para compatibilidad durante la migración.

## Regla editorial

El motor no resume ni inventa automáticamente una tabla extensa. La migración debe ser explícita: un adaptador escribe la narrativa sustentada y traslada los datos completos a `appendixTable`. La función `validateNarrativeDensity` detecta secciones con más de una tabla inline o tablas de más de ocho filas.

## Renderers

### Technical Evidence Report

El renderer A4:
- renderiza narrativa y metadatos de procedencia;
- muestra hallazgos, evidencia, gaps y recomendaciones como callouts;
- permite figuras y mapas dentro de la secuencia;
- recoge todos los `appendixTable` y los imprime al final como anexos A, B, C…;
- conserva la sección final de limitaciones.

### Investor Deck

El deck consume los mismos bloques narrativos en las secciones marcadas `deck`. Los anexos no se vuelcan a las láminas.

## Primera migración: Cholqui v3.1

Cholqui deja de presentar el cuerpo técnico como una sucesión de tablas:

1. Geología: narrativa + observación + interpretación + potencial conceptual claramente rotulado.
2. Laboratorio: narrativa y evidencia certificada; informes y resultados completos se trasladan a anexos.
3. Escenario operacional: queda separado como SCENARIO y restringido al perfil investment.
4. Brechas: se expresan como data gaps y una recomendación de cierre, no como una tabla de faltantes.

No se agrega información nueva a Cholqui. La migración reorganiza los antecedentes ya presentes en el adaptador y conserva sus caveats.

## Siguiente fase

REPORT-03 conectará estos bloques con report readiness, dataset provenance, fecha de corte, versionado y estado QP/CP. REPORT-04 incorporará Toki 2/DEM y el programa de ground-truth al nuevo formato técnico de Cholqui.
