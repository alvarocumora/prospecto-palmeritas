"""B5.2 · Motor de patentes y carry (librería).

Calcula el costo anual de mantener la tenencia y su proyección a 10 años, desde:
- la escala de patente (tabla patentes_escala, Ley 21.420) — nada hardcodeado;
- el valor de la UTM (tabla valores_utm, fechado) — si tiene más de 35 días, el
  resultado se marca desactualizado (§B5.2).

Basado solo en superficie, tipo, año de vigencia y fechas. No infiere la
situación financiera de nadie. Los parámetros legales van marcados como no
verificados si su fecha_verificacion es NULL.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from typing import Optional

UTM_MAX_DIAS = 35  # §B5.2: si la UTM tiene más de 35 días, resultado desactualizado.


@dataclass
class TramoEscala:
    id: str
    tipo_solicitud: str
    con_labores: bool
    ano_desde: int
    ano_hasta: Optional[int]
    valor_utm_por_ha: float
    articulo_citado: str
    fecha_verificacion: Optional[str] = None

    @property
    def verificado(self) -> bool:
        return self.fecha_verificacion is not None


@dataclass
class ValorUTM:
    fecha: date
    valor_clp: float
    fuente: Optional[str] = None


@dataclass
class UTMVigente:
    valor_clp: float
    fecha: date
    dias: int
    desactualizada: bool


@dataclass
class AnoProyeccion:
    ano_vigencia: int
    utm_por_ha: float
    patente_clp: float
    tramo_id: str
    no_verificado: bool


@dataclass
class CarryResultado:
    proyeccion: list[AnoProyeccion] = field(default_factory=list)
    total_10a_clp: float = 0.0
    utm: Optional[UTMVigente] = None
    ano_prohibitivo: Optional[int] = None
    parametros_no_verificados: list[str] = field(default_factory=list)


def utm_vigente(valores: list[ValorUTM], hoy: date) -> Optional[UTMVigente]:
    if not valores:
        return None
    v = max(valores, key=lambda x: x.fecha)
    dias = (hoy - v.fecha).days
    return UTMVigente(v.valor_clp, v.fecha, dias, dias > UTM_MAX_DIAS)


def _tramo(escala: list[TramoEscala], tipo: str, con_labores: bool, ano: int) -> Optional[TramoEscala]:
    for t in escala:
        if (t.tipo_solicitud == tipo and t.con_labores == con_labores
                and t.ano_desde <= ano and (t.ano_hasta is None or ano <= t.ano_hasta)):
            return t
    return None


def patente_anual_clp(area_ha: float, utm_por_ha: float, utm_clp: float,
                      prop_meses: int = 12) -> float:
    """Patente anual en CLP. prop_meses<12 aplica proporcionalidad del primer año."""
    return round(area_ha * utm_por_ha * utm_clp * (prop_meses / 12.0), 0)


def proyeccion_carry(
    area_ha: float,
    tipo: str,
    con_labores: bool,
    escala: list[TramoEscala],
    valores_utm: list[ValorUTM],
    hoy: date,
    ano_inicio: int = 1,
    horizonte: int = 10,
    prop_meses_primer_ano: int = 12,
    umbral_prohibitivo_utm_ha: float = 3.0,
) -> CarryResultado:
    utm = utm_vigente(valores_utm, hoy)
    utm_clp = utm.valor_clp if utm else 0.0

    proy: list[AnoProyeccion] = []
    no_verif: set[str] = set()
    ano_prohibitivo: Optional[int] = None

    for i in range(horizonte):
        ano = ano_inicio + i
        t = _tramo(escala, tipo, con_labores, ano)
        if t is None:
            continue
        if not t.verificado:
            no_verif.add(t.id)
        prop = prop_meses_primer_ano if i == 0 else 12
        clp = patente_anual_clp(area_ha, t.valor_utm_por_ha, utm_clp, prop)
        proy.append(AnoProyeccion(ano, t.valor_utm_por_ha, clp, t.id, not t.verificado))
        # Carry "prohibitivo sin labores": primer año en que la tarifa supera el umbral.
        if (ano_prohibitivo is None and not con_labores
                and t.valor_utm_por_ha >= umbral_prohibitivo_utm_ha):
            ano_prohibitivo = ano

    return CarryResultado(
        proyeccion=proy,
        total_10a_clp=round(sum(p.patente_clp for p in proy), 0),
        utm=utm,
        ano_prohibitivo=ano_prohibitivo,
        parametros_no_verificados=sorted(no_verif),
    )


def costo_cartera_clp(
    concesiones: list[dict],  # [{area_ha, tipo, con_labores, ano_vigencia}]
    escala: list[TramoEscala],
    valores_utm: list[ValorUTM],
    hoy: date,
) -> dict:
    """Costo anual total de una cartera (año actual de cada concesión)."""
    utm = utm_vigente(valores_utm, hoy)
    utm_clp = utm.valor_clp if utm else 0.0
    total = 0.0
    no_verif: set[str] = set()
    for c in concesiones:
        t = _tramo(escala, c["tipo"], c.get("con_labores", False), c.get("ano_vigencia", 1))
        if t is None:
            continue
        if not t.verificado:
            no_verif.add(t.id)
        total += patente_anual_clp(c["area_ha"], t.valor_utm_por_ha, utm_clp)
    return {
        "total_clp": round(total, 0),
        "utm": utm,
        "parametros_no_verificados": sorted(no_verif),
    }


def cargar_escala(cursor) -> list[TramoEscala]:
    cursor.execute(
        "SELECT id, tipo_solicitud, con_labores, ano_desde, ano_hasta, valor_utm_por_ha, "
        "articulo_citado, fecha_verificacion FROM public.patentes_escala"
    )
    return [
        TramoEscala(id=r[0], tipo_solicitud=r[1], con_labores=r[2], ano_desde=r[3],
                    ano_hasta=r[4], valor_utm_por_ha=float(r[5]), articulo_citado=r[6],
                    fecha_verificacion=str(r[7]) if r[7] is not None else None)
        for r in cursor.fetchall()
    ]


def cargar_valores_utm(cursor) -> list[ValorUTM]:
    cursor.execute("SELECT fecha, valor_clp, fuente FROM public.valores_utm")
    return [ValorUTM(fecha=r[0], valor_clp=float(r[1]), fuente=r[2]) for r in cursor.fetchall()]
