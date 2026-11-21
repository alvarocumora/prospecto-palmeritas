# Barrido de faenas en concesiones eliminadas

Revisión del 18-11-2026. Se revisaron en imagen satelital (z17, recortes de 600 m) 363 concesiones de **explotación** eliminadas del catastro SERNAGEOMIN con al menos 5 ha libres:

- 149 en Illapel / Cerro Alto (marco WGS84 UTM 19S).
- 214 en Tilama, Petorca y Los Vilos (marco PSAD56 H19 del catastro).

Cada recorte se marcó con el polígono eliminado (amarillo) y las concesiones vigentes o en trámite (rojo). En los candidatos fuertes se pintó el área libre en verde para comprobar que la faena cae dentro de ella (`fichas_A_1.jpg`, `fichas_A_2.jpg`).

## Categorías

- **A**: faena clara (rajo, pique, desmonte o camino minero) dentro del área libre. 15 casos.
- **B**: indicios (huellas, zigzag, plataformas, desmontes pequeños), o una faena que queda fuera del área libre pero tiene accesos dentro. 33 casos.
- **Alt**: alteración visible en la roca o el suelo, sin labores. 6 casos.

## Archivos

- `barrido_faenas_eliminadas.csv`: una fila por candidato con:
  - nombre, rol, ex titular, comuna, juzgado
  - hectáreas originales y libres
  - un punto dentro del área libre (en el datum de su zona) y lat/lon
  - qué se ve
  - si alguna pieza ya diseñada lo cubre
- `barrido_faenas_eliminadas.kmz`: polígonos del área libre en tres carpetas (A, B y Alt).

## Advertencias

- El punto E/N del CSV es un punto **dentro del área libre**. No es la ubicación exacta de la labor; esa se ve en el KMZ.
- **DON HUGO 1/30 (CA095)** muestra un rajo escalonado y lo que parece un tranque o depósito, lo que sugiere una faena activa. Antes de pedir hay que averiguar quién opera ahí (puede tener título en trámite que no aparece en la capa, o ser una planta). Por ahora el área figura libre en el catastro.
- "Libre" se refiere solo al catastro del 18-11-2026. Antes de presentar, el perito debe confirmarlo en terreno y con el catastro del día.
- Juzgados de Canela, Petorca y Cabildo: verificar en la OJV.

Scripts: `scripts/barrido_hojas.py`, `scripts/barrido_libre.py`, `scripts/barrido_final.py` (recortes generados con `scripts/tilama_imagenes.py`, `TILAMA_ZONA=chips`).
