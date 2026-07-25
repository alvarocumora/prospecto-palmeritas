"""B4 · Diseñador de bloques de solicitud.

Dado un área de interés (AOI, GeoJSON WGS84) y el tipo de solicitud, propone una
cuadrícula de bloques que CUMPLEN las reglas del Código de Minería (motor B5.1):
superficie de la cara, lado máximo, múltiplos de lado y orientación N-S/E-O.
Devuelve la tabla de vértices lista para la ficha del front.

Trabaja en UTM PSAD56 alineado a SERNAGEOMIN (EPSG:1204, towgs84=-288,175,-376;
ver docs/datums.md) para que los vértices calcen con el datum del catastro.
Las dimensiones de bloque se DERIVAN de las reglas (no se hardcodean); si las
reglas no están verificadas, el resultado lo declara.
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Optional

from pyproj import Transformer
from shapely.geometry import Polygon, shape


@dataclass
class Bloque:
    indice: int
    vertices_utm: list[tuple[float, float]]  # [(E,N), ...] PSAD56 UTM
    huso: int
    area_ha: float
    geom_geojson: dict


@dataclass
class DisenoResultado:
    bloques: list[Bloque] = field(default_factory=list)
    total_ha: float = 0.0
    cell_m: Optional[float] = None
    huso: Optional[int] = None
    parametros_no_verificados: list[str] = field(default_factory=list)


def _huso(lon: float) -> int:
    return 18 if lon < -72 else 19


def _psad56_utm(huso: int) -> str:
    return f"+proj=utm +zone={huso} +south +ellps=intl +towgs84=-288,175,-376 +units=m +no_defs"


def _rule_val(reglas, tipo, regla, operador) -> Optional[float]:
    for r in reglas:
        if (r.tipo_solicitud == tipo and r.regla == regla and r.operador == operador
                and r.valor is not None):
            return float(r.valor)
    return None


def disenar_bloques(aoi_geojson: dict, tipo: str, reglas: list) -> DisenoResultado:
    cara_max_ha = _rule_val(reglas, tipo, "cara_superior", "<=")
    lado_max_m = _rule_val(reglas, tipo, "lado_mas_largo", "<=")
    multiplo_m = _rule_val(reglas, tipo, "lado_multiplo", "==")
    if not (cara_max_ha and lado_max_m and multiplo_m):
        raise ValueError("faltan reglas (cara_max/lado_max/multiplo) para el tipo " + tipo)

    # Bloque cuadrado: el mayor múltiplo legal con cara ≤ cara_max y lado ≤ lado_max.
    lado_por_area = math.floor(math.sqrt(cara_max_ha * 10000) / multiplo_m) * multiplo_m
    lado_por_max = math.floor(lado_max_m / multiplo_m) * multiplo_m
    cell = float(min(lado_por_area, lado_por_max))

    aoi_wgs: Polygon = shape(aoi_geojson)
    huso = _huso(aoi_wgs.centroid.x)
    fwd = Transformer.from_crs("EPSG:4326", _psad56_utm(huso), always_xy=True)
    inv = Transformer.from_crs(_psad56_utm(huso), "EPSG:4326", always_xy=True)
    aoi_utm = Polygon([fwd.transform(x, y) for x, y in aoi_wgs.exterior.coords])

    minx, miny, maxx, maxy = aoi_utm.bounds
    # Origen de la grilla en múltiplos de `cell` (requisito de múltiplos de lado).
    ox = math.floor(minx / cell) * cell
    oy = math.floor(miny / cell) * cell

    bloques: list[Bloque] = []
    idx = 0
    y = oy
    while y < maxy:
        x = ox
        while x < maxx:
            celda = Polygon([(x, y), (x + cell, y), (x + cell, y + cell), (x, y + cell)])
            # Solo bloques COMPLETOS dentro del AOI (un bloque recortado dejaría de ser
            # un rectángulo legal con lados múltiplos).
            if aoi_utm.contains(celda):
                verts_utm = [(round(x, 2), round(y, 2)), (round(x + cell, 2), round(y, 2)),
                             (round(x + cell, 2), round(y + cell, 2)), (round(x, 2), round(y + cell, 2))]
                ring_wgs = [list(inv.transform(vx, vy)) for vx, vy in verts_utm]
                ring_wgs.append(ring_wgs[0])
                bloques.append(Bloque(
                    indice=idx, vertices_utm=verts_utm, huso=huso,
                    area_ha=round(cell * cell / 10000.0, 2),
                    geom_geojson={"type": "Polygon", "coordinates": [ring_wgs]},
                ))
                idx += 1
            x += cell
        y += cell

    no_verif = [r.id for r in reglas if r.tipo_solicitud == tipo and not getattr(r, "verificada", True)]
    return DisenoResultado(
        bloques=bloques,
        total_ha=round(sum(b.area_ha for b in bloques), 2),
        cell_m=cell,
        huso=huso,
        parametros_no_verificados=no_verif,
    )
