# Barrido de la costa IV Región y el norte de la V Región

Catastro SERNAGEOMIN bajado el 18-11-2026 con `scripts/barrido_catastro_zona.py`:

- Costa de Los Vilos y Canela: 3.898 concesiones, 449 de ellas de explotación eliminadas.
- Norte de la V Región (Papudo a Til Til): 11.891 concesiones, 1.816 de ellas de explotación eliminadas.

Las concesiones de explotación eliminadas con al menos 5 ha libres (1.455) se pasaron a una grilla de 50 m. Cada celda se ponderó según cuántas concesiones históricas se superponen; las más chicas pesan más, porque suelen marcar una labor puntual. Así salieron 511 focos, que se revisaron con recortes satelitales de 600 m (rama `data/barrido-zona`).

## Resultado

Se revisaron a ojo los focos V001 a V336, que son los de mayor puntaje. Los V337 a V511 son focos con una sola concesión histórica y quedan pendientes.

La costa y la V Región rinden bastante menos que Tilama e Illapel. Muchos focos caen en:

- dunas (Canela)
- lechos de río (Aconcagua, Petorca)
- cultivos o parcelaciones (Quillota, Zapallar)
- canteras de áridos

Quedaron:

- **A (4)**:
  - MAITEN 1/4 (Cabildo): camino en zigzag a labor.
  - FRIEINPERMUNDINER 1/10 (Cabildo): rajo con huellas.
  - CAROLINA 1/10 (Cabildo): desmonte en la parte alta.
  - CHILE 1/7 (Petorca): zanjas y labores junto al camino.
- **B (18)**: huellas, plataformas y labores parciales. Ver el CSV.
- **Alteración (2)**: CELESTE 2 (Petorca).

El núcleo con más labores está en Cabildo, cuyo tribunal es probablemente el Juzgado de La Ligua (por confirmar).
