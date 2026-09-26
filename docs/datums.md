# Datums y sistemas de referencia (B1)

> Bloque bloqueante. Chile arrastra **PSAD56, WGS84 y SIRGAS-Chile** en documentos mineros
> vigentes; entre PSAD56 y WGS84 hay ~200 m de desplazamiento en el centro-sur. Un polígono
> corrido esos 200 m cae sobre concesión ajena y genera una oposición evitable, invisible
> hasta la demanda. Todo se almacena en **EPSG:4326**; la conversión ocurre en los bordes.

## 1. Códigos EPSG (verificados)

| CRS                         | EPSG      | Estado / fuente                                                 |
| --------------------------- | --------- | --------------------------------------------------------------- |
| PSAD56 / UTM 18S            | **24877** | epsg.io (par estándar de 24879)                                 |
| PSAD56 / UTM 19S            | **24879** | epsg.io: "PSAD56 / UTM zone 19S", datum PSAD56, Chile N de 45°S |
| WGS84 / UTM 18S             | **32718** | estándar global WGS84 UTM 18S sur                               |
| WGS84 / UTM 19S             | **32719** | estándar global WGS84 UTM 19S sur                               |
| WGS84 geográfico (canónico) | **4326**  | —                                                               |
| SIRGAS-Chile 2002 / UTM 19S | 5361      | epsg.io                                                         |
| SIRGAS-Chile 2016 / UTM 19S | 9155      | epsg.io                                                         |
| SIRGAS-Chile 2021 / UTM 19S | 20049     | epsg.io                                                         |

Detección de huso por longitud: **huso 18 al oeste de 72°W, huso 19 al este**.

## 2. Transformación PSAD56 → WGS84 — HALLAZGO CENTRAL

Circula la idea de usar transformaciones **por franja latitudinal** (EPSG 6971/6972/6973:
N de 26°S / 26–36°S / 36–43°30'S), que son las "más precisas a WGS84 real". **PERO el
catastro oficial de SERNAGEOMIN NO las usa.**

Verificado contra el **FeatureServer oficial** de SERNAGEOMIN (ArcGIS Online, capa
`WGS84_Vertice`, que publica cada vértice con **NORTE/ESTE en PSAD56** y **geometría en
WGS84**): SERNAGEOMIN transforma con un **único juego nacional**:

> **PSAD56 → WGS84 = EPSG:1204, geocentric translations `[-288, 175, -376]`**

Comprobado a **0.000 m** en 24 vértices reales (husos 18/19, norte/centro/sur). Los
parámetros por franja difieren de SERNAGEOMIN (medido: 32–75 m, prom 54 m en los puntos de
control) — usarlos desalinearía los polígonos del usuario decenas de metros respecto del
catastro (justo el riesgo que este bloque combate).

**Decisión:** para que los traslapes calcen con el catastro oficial, GeoCapitals usa la
**misma** transformación que SERNAGEOMIN (EPSG:1204). SIRGAS-Chile ≈ WGS84 (GRS80, <1 m).

## 3. Puntos de control (≥10, fuente citable)

`src/lib/tenencia/control-points.json` — **14 pares** PSAD56↔WGS84 de fuente autoritativa:
la capa `WGS84_Vertice` del FeatureServer oficial de SERNAGEOMIN
(`services1.arcgis.com/OyjvVdFTl5hfSdX3/arcgis/rest/services/Marcelo_Layer/FeatureServer/0`).
Cada par: PSAD56 (NORTE/ESTE + huso) ↔ WGS84 (lon/lat). Husos 18 y 19, tres zonas del país.
**Ningún valor inventado.** (Más un punto de proyección de PMD, screenshot IMG_2278.)

## 4. Suite de tests (B1) — `tests/datum/`

Corre en CI y **falla el build** si un punto se sale de tolerancia (`.github/workflows/datum.yml`).

1. **pyproj (EPSG:1204)** vs los 14 puntos de control → tolerancia **1 m**.
2. **proj4js vs pyproj** (misma transformación) → cuantifica el **error del camino cliente**
   (el navegador usa proj4js). Se documenta el número; la UI debe declararlo al previsualizar.
3. **PostGIS `ST_Transform`** (SRID custom con EPSG:1204) vs pyproj → sanity (ambos usan PROJ).
4. **Gap por franja:** parámetros EPSG por franja (6971/6972/6973), con params explícitos, vs los
   puntos → cuantifica el desfase (32–75 m, prom 54 m) que aparece si NO se calibra a SERNAGEOMIN.
5. **Detección de huso** por longitud, con test en la frontera 18S/19S (72°W).

### Error del camino cliente (proj4js)

Se mide en CI (test 2) y queda registrado en la salida del test. La UI que use proj4js para
**previsualizar** debe declarar ese margen; la conversión que toca la base usa PROJ (PostGIS).
