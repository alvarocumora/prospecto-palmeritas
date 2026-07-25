"""B5 · Motor de reglas del Código de Minería (librería).

Recibe un polígono (GeoJSON WGS84) y el tipo de solicitud, y devuelve las
infracciones geométricas citando el artículo desde la tabla `reglas_codigo_minero`.
Regla dura (§v2): NINGÚN parámetro legal va en el código — se pasan como `reglas`
(cargadas de la tabla). Si una regla no tiene `fecha_verificacion`, el resultado
la marca como parámetro NO verificado (no la da por válida).

Cómputos en proyección UTM (metros), huso por longitud del centroide. La
concesión legal es un cuadrilátero con caras N-S/E-O; se validan área de la cara,
lado más largo, relación largo/ancho, orientación y múltiplos de lado.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional

from pyproj import Transformer
from shapely.geometry import shape
from shapely.ops import transform as shp_transform


@dataclass
class Regla:
    id: str
    tipo_solicitud: str
    regla: str
    operador: Optional[str]
    valor: Optional[float]
    unidad: Optional[str]
    articulo_citado: str
    fecha_verificacion: Optional[str] = None  # None = NO verificada

    @property
    def verificada(self) -> bool:
        return self.fecha_verificacion is not None


@dataclass
class Infraccion:
    regla: str
    articulo_citado: str
    detalle: str
    esperado: str
    obtenido: str
    no_verificado: bool


@dataclass
class Resultado:
    conforme: bool
    infracciones: list[Infraccion] = field(default_factory=list)
    parametros_no_verificados: list[str] = field(default_factory=list)
    metricas: dict = field(default_factory=dict)


def _huso(lon: float) -> int:
    return 18 if lon < -72 else 19


def _to_utm(geom):
    """Proyecta un shapely geom WGS84 a UTM (WGS84) del huso de su centroide."""
    c = geom.centroid
    huso = _huso(c.x)
    epsg = 32718 if huso == 18 else 32719
    t = Transformer.from_crs("EPSG:4326", f"EPSG:{epsg}", always_xy=True)
    return shp_transform(lambda x, y, z=None: t.transform(x, y), geom)


def _edges(ring) -> list[tuple[float, float]]:
    """Lista de (dx, dy) de cada arista del anillo exterior (metros, UTM)."""
    pts = list(ring.coords)
    return [(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]) for i in range(len(pts) - 1)]


def _check(regla: Regla, obtenido: float, tol: float = 1e-6) -> bool:
    """True = cumple. operadores numéricos."""
    if regla.valor is None:
        return True  # sin valor (por verificar): no se evalúa como infracción
    if regla.operador == "<=":
        return obtenido <= regla.valor + tol
    if regla.operador == ">=":
        return obtenido >= regla.valor - tol
    if regla.operador == "==":
        return abs(obtenido) < tol or abs(obtenido % regla.valor) < 1.0  # múltiplos
    return True


def validar_solicitud(geojson_geom: dict, tipo: str, reglas: list[Regla]) -> Resultado:
    geom_wgs = shape(geojson_geom)
    utm = _to_utm(geom_wgs)
    ring = utm.exterior
    edges = _edges(ring)

    minx, miny, maxx, maxy = utm.bounds
    largo_bbox = max(maxx - minx, maxy - miny)
    ancho_bbox = min(maxx - minx, maxy - miny)
    lado_mas_largo = max((abs(dx) + abs(dy)) for dx, dy in edges) if edges else 0.0
    ratio = (largo_bbox / ancho_bbox) if ancho_bbox > 0 else float("inf")
    cara_ha = utm.area / 10000.0
    # Orientación: cada arista debe ser ~vertical (dx≈0) u ~horizontal (dy≈0).
    ORT_TOL = 1.0  # metros
    ejes_ok = all(abs(dx) < ORT_TOL or abs(dy) < ORT_TOL for dx, dy in edges)

    metricas = {
        "cara_ha": round(cara_ha, 2),
        "lado_mas_largo_m": round(lado_mas_largo, 1),
        "ratio_largo_ancho": round(ratio, 2),
        "orientada_ns_eo": ejes_ok,
    }

    aplicables = [r for r in reglas if r.tipo_solicitud == tipo]
    infracciones: list[Infraccion] = []
    no_verif = [r.id for r in aplicables if not r.verificada]

    for r in aplicables:
        nv = not r.verificada
        if r.regla == "cara_superior":
            if not _check(r, cara_ha):
                infracciones.append(Infraccion(r.regla, r.articulo_citado,
                    "Superficie de la cara fuera de rango",
                    f"{r.operador} {r.valor} {r.unidad}", f"{cara_ha:.2f} ha", nv))
        elif r.regla == "lado_mas_largo":
            if not _check(r, lado_mas_largo):
                infracciones.append(Infraccion(r.regla, r.articulo_citado,
                    "Lado más largo excede el máximo",
                    f"{r.operador} {r.valor} m", f"{lado_mas_largo:.1f} m", nv))
        elif r.regla == "relacion_largo_ancho":
            if not _check(r, ratio):
                infracciones.append(Infraccion(r.regla, r.articulo_citado,
                    "Relación largo/ancho excede el máximo",
                    f"{r.operador} {r.valor}:1", f"{ratio:.2f}:1", nv))
        elif r.regla == "orientacion_caras":
            if not ejes_ok:
                infracciones.append(Infraccion(r.regla, r.articulo_citado,
                    "Las caras no están orientadas N-S / E-O (UTM)",
                    "caras N-S y E-O", "caras oblicuas", nv))
        elif r.regla == "lado_multiplo" and r.valor:
            malos = [e for e in (abs(dx) + abs(dy) for dx, dy in edges)
                     if e > 1.0 and abs(e % r.valor) > 1.0 and abs(e % r.valor - r.valor) > 1.0]
            if malos:
                infracciones.append(Infraccion(r.regla, r.articulo_citado,
                    "Longitud de lados no es múltiplo del requerido",
                    f"múltiplos de {r.valor:.0f} m", f"{len(malos)} lado(s) no conforme(s)", nv))

    return Resultado(
        conforme=len(infracciones) == 0,
        infracciones=infracciones,
        parametros_no_verificados=no_verif,
        metricas=metricas,
    )


def cargar_reglas(cursor) -> list[Regla]:
    """Carga las reglas desde la tabla reglas_codigo_minero (psycopg cursor)."""
    cursor.execute(
        "SELECT id, tipo_solicitud, regla, operador, valor, unidad, articulo_citado, "
        "fecha_verificacion FROM public.reglas_codigo_minero"
    )
    out = []
    for row in cursor.fetchall():
        out.append(Regla(
            id=row[0], tipo_solicitud=row[1], regla=row[2], operador=row[3],
            valor=float(row[4]) if row[4] is not None else None, unidad=row[5],
            articulo_citado=row[6],
            fecha_verificacion=str(row[7]) if row[7] is not None else None,
        ))
    return out
