# Protocolo de análisis satelital por distrito — GeoCapitals

Operacionaliza el protocolo de teledetección en el **pipeline real del repo**
(`geocapitals-remote/`, Sentinel-2 L2A vía Microsoft Planetary Computer + STAC),
no en Google Earth Engine. La ciencia es la misma; la diferencia es que aquí es
reproducible, versionada y con la disciplina de *no inventar datos*.

## 1. La ciencia (correcta) y cómo la implementamos

Para **REE en arcillas de adsorción iónica (REE-IAD)** el portador es la
**kaolinita** del regolito (paleosuelos de la Cordillera Costera de Chile, XRD;
ScienceDirect 2023). El proxy espectral correcto es **kaolinita**, no los REE
directamente — Sentinel-2 tiene bandas demasiado anchas para resolver las
absorciones diagnósticas de Nd³⁺ (~740/800 nm); eso solo es válido con
hiperespectral (EMIT/EnMAP/PRISMA).

Los índices del protocolo ya existen en `gc_remote/indices.py` (razones de banda
Sentinel-2), y se agregaron los específicos para REE-IAD:

| Protocolo (nombre común) | Nuestro índice | Fórmula S2 | Qué afirma (y qué NO) |
|---|---|---|---|
| Clay Minerals Ratio (CMR) | `aloh` | B11/B12 | Anomalía Al-OH. **No identifica mineral.** |
| Iron Oxide Ratio | `fe_oxides` | B04/B02 | Realce óxidos de Fe. |
| Ferrous Iron | `ferrous` | B11/B8A | Realce Fe²⁺. |
| Gossan | `gossan` | (B04/B02)·(B11/B12) | Indicio gossan; no diagnóstico. |
| **Kaolinite Index (KI)** | `kaolinite` | (B11+B08)/(B12+B04) | Proxy REE-IAD. **No mide ley REE.** |
| **Bare Soil Index (BSI)** | `bare_soil` | ((B11+B04)−(B08+B02))/((B11+B04)+(B08+B02)) | Regolito **expuesto** vs. dosel. |
| Máscara vegetación | NDVI | (B08−B04)/(B08+B04) | Umbral 0.25 (sensibilidad 0.20–0.30). |

> No se necesita Google Earth Engine: el mismo cómputo corre con
> `run_project_targets.py --aoi <geojson> --name <distrito>`, que entrega
> cobertura + anomalías + grilla en formato consumible por la UI.

## 2. Regla inviolable: **cobertura antes que anomalías**

Un índice de kaolinita sobre dosel forestal no crea suelo observable: mide
vegetación. Por eso **todo distrito se evalúa primero por cobertura
interpretable (BSI/NDVI)**. Si está bajo el piso (15%), el análisis espectral
**no es concluyente** y el valor pasa al DEM (estructura/mesetas) y al SAR.

### Caso Nahuelbuta (medido, no de memoria)

| Área evaluada | Superficie | Interpretable óptico | Veredicto |
|---|---|---|---|
| Bbox regional del protocolo | ~515.000 ha | **62.7%** | Engañoso: es agrícola/costa, no el target |
| **34 paños Arcillas (target REE)** | ~23.500 ha | **0.53%** | **NO concluyente** — dosel sobre el batolito |

El número regional alto es **falso consuelo**: el bosque/plantación se asienta
exactamente sobre el batolito de Nahuelbuta, que es donde se preservan las
arcillas. Sobre el objetivo real la cobertura óptica es ~0.5%. **Conclusión: para
Nahuelbuta REE el óptico no aporta; la señal real es DEM (mesetas de
meteorización, ya derivadas) + radiometría (Th/U) + geoquímica de regolito.**

## 3. Matriz de aplicabilidad por distrito

| Distrito | Objetivo | ¿Óptico viable? | Vía real |
|---|---|---|---|
| **Nahuelbuta REE** | REE-IAD (kaolinita) | ❌ dosel (~0.5% target) | **DEM mesetas + radiometría + geoquímica** |
| **Arauco carbón-REE** | REE supérgeno | ❌ boscoso/húmedo | DEM + geoquímica de escombreras |
| **ELARA 1 (Maricunga)** | Au epitermal/pórfido | ✅ árido, sin vegetación | S2 alteración (aloh/gossan/fe) + ASTER SWIR |
| **Cholqui Au-Cu** | Au-Cu | ⚠️ parcial (verano) | S2 + validar cobertura por temporada |
| **La Cornellana / Caone** | según objetivo | ⚠️ verificar | correr cobertura antes |

**Kaolinita (KI+BSI) rinde donde hay regolito expuesto** (semiárido). En los
distritos boscosos el proxy correcto no es espectral sino geomorfológico +
geoquímico.

## 4. Guardas

- Ningún índice identifica un mineral ni mide ley: son **razones de banda anchas**
  = indicios, con `INDEX_META` declarando el límite en cada capa.
- La favorabilidad de meseta (DEM) es un **proxy geomorfológico** de dónde se
  preserva la arcilla — no mide REE.
- Toda anomalía/objetivo es PROPUESTA/DERIVADO; requiere geoquímica + estudio de
  títulos + consulta indígena (Convenio 169) antes de decisiones.
- Datum de trabajo WGS84/UTM (huso 18S EPSG:32718 costa sur; huso 19S EPSG:32719
  norte).

## 5. Reproducir

```bash
cd geocapitals-remote
python3 scripts/run_project_targets.py \
  --aoi ../src/data/geo/<distrito>_aoi.geojson \
  --name <distrito> --output-crs EPSG:327XX
# imprime cobertura típica/mejor-caso y veredicto espectral_concluyente
```
Si `espectral_concluyente = False`, no se publican anomalías espectrales: se pasa
a DEM/SAR. Así se evita el pasivo de un target inventado sobre bosque.
