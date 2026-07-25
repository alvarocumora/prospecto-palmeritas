"""B5.3 · Motor de prospectividad de arcillas iónicas REE (librería, sin red).

Score TRANSPARENTE y explicable: cada componente (litología, proximidad a
contactos, pendiente) reporta su aporte. Los pesos y factores son EDITABLES y
viven en la tabla reglas_prospectividad; nada va hardcodeado aquí.

Encuadre obligatorio (Ley 20.235): esto es PRIORIZACIÓN EXPLORATORIA, NO una
estimación de recursos/reservas (que exige Persona Competente). La etiqueta
ETIQUETA se adjunta a CADA celda; los tests lo verifican.

Reglas v2:
- Un factor sin dato para la celda contribuye 0 y se marca en flags. NUNCA se
  rellena con un valor verosímil por defecto.
- Si algún parámetro usado tiene fecha_verificacion NULL, la celda sale marcada
  `no_verificado`.

El motor emite celdas con la MISMA forma que public.prospectivity_cells (score
0-100 + features jsonb), para alimentar el renderer que Lovable ya tiene.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional

ETIQUETA = "priorización exploratoria, no estimación de recursos"
MODELO = "ree_arcilla_ionica"


@dataclass
class Regla:
    grupo: str
    clave: str
    valor: Optional[float]
    fecha_verificacion: Optional[str] = None

    @property
    def verificado(self) -> bool:
        return self.fecha_verificacion is not None


@dataclass
class Reglas:
    pesos: dict            # clave -> Regla
    litologia: dict        # clase -> Regla
    params: dict           # clave -> Regla


@dataclass
class FactoresCelda:
    cell_lat: float
    cell_lng: float
    cell_size_m: float
    litologia_clase: Optional[str] = None
    distancia_contacto_m: Optional[float] = None
    pendiente_grados: Optional[float] = None


@dataclass
class Componente:
    factor: str
    favorabilidad: float          # 0-1
    peso: float                   # normalizado
    aporte: float                 # favorabilidad * peso (contribución al score 0-1)
    no_verificado: bool
    flags: list[str] = field(default_factory=list)


@dataclass
class CeldaProspectividad:
    cell_lat: float
    cell_lng: float
    cell_size_m: float
    score: float                  # 0-100
    componentes: list[Componente]
    no_verificado: bool
    flags: list[str]

    @property
    def etiqueta(self) -> str:
        return ETIQUETA


def _clamp01(x: float) -> float:
    return max(0.0, min(1.0, x))


def favorabilidad_litologia(clase: Optional[str], reglas: Reglas) -> tuple[float, bool, list[str]]:
    if not clase:
        return 0.0, True, ["litologia_ausente"]
    r = reglas.litologia.get(clase.strip().lower())
    if r is None or r.valor is None:
        # Clase no tabulada o sin favorabilidad: no se inventa un valor.
        return 0.0, True, ["litologia_desconocida"]
    return _clamp01(float(r.valor)), (not r.verificado), []


def _decaimiento(valor: Optional[float], optimo: Optional[float], maximo: Optional[float],
                 flag_falta: str) -> tuple[float, list[str]]:
    """1.0 hasta 'optimo'; decae lineal a 0 en 'maximo'; 0 más allá. Sin dato => 0."""
    if valor is None:
        return 0.0, [flag_falta]
    if optimo is None or maximo is None or maximo <= optimo:
        return 0.0, ["parametro_invalido"]
    if valor <= optimo:
        return 1.0, []
    if valor >= maximo:
        return 0.0, []
    return _clamp01((maximo - valor) / (maximo - optimo)), []


def favorabilidad_contacto(dist_m: Optional[float], reglas: Reglas) -> tuple[float, bool, list[str]]:
    opt = reglas.params.get("distancia_contacto_optima_m")
    mx = reglas.params.get("distancia_contacto_max_m")
    fav, flags = _decaimiento(dist_m, opt.valor if opt else None, mx.valor if mx else None,
                              "sin_dato_contacto")
    no_verif = not (opt and opt.verificado and mx and mx.verificado)
    return fav, no_verif, flags


def favorabilidad_pendiente(grados: Optional[float], reglas: Reglas) -> tuple[float, bool, list[str]]:
    opt = reglas.params.get("pendiente_optima_max_grados")
    mx = reglas.params.get("pendiente_max_grados")
    fav, flags = _decaimiento(grados, opt.valor if opt else None, mx.valor if mx else None,
                              "sin_dato_pendiente")
    no_verif = not (opt and opt.verificado and mx and mx.verificado)
    return fav, no_verif, flags


def _pesos_normalizados(reglas: Reglas) -> dict:
    crudos = {k: float(r.valor) for k, r in reglas.pesos.items() if r.valor is not None}
    total = sum(crudos.values())
    if total <= 0:
        # Sin pesos válidos: reparto uniforme entre los tres factores conocidos.
        return {k: 1 / 3 for k in ("litologia", "contacto", "pendiente")}
    return {k: v / total for k, v in crudos.items()}


def puntuar_celda(f: FactoresCelda, reglas: Reglas) -> CeldaProspectividad:
    pesos = _pesos_normalizados(reglas)

    fav_lit, nv_lit, fl_lit = favorabilidad_litologia(f.litologia_clase, reglas)
    fav_con, nv_con, fl_con = favorabilidad_contacto(f.distancia_contacto_m, reglas)
    fav_pen, nv_pen, fl_pen = favorabilidad_pendiente(f.pendiente_grados, reglas)

    peso_lit_nv = reglas.pesos.get("litologia")
    peso_con_nv = reglas.pesos.get("contacto")
    peso_pen_nv = reglas.pesos.get("pendiente")

    comps = [
        Componente("litologia", fav_lit, pesos.get("litologia", 0.0),
                   round(fav_lit * pesos.get("litologia", 0.0), 6),
                   nv_lit or not (peso_lit_nv and peso_lit_nv.verificado), fl_lit),
        Componente("contacto", fav_con, pesos.get("contacto", 0.0),
                   round(fav_con * pesos.get("contacto", 0.0), 6),
                   nv_con or not (peso_con_nv and peso_con_nv.verificado), fl_con),
        Componente("pendiente", fav_pen, pesos.get("pendiente", 0.0),
                   round(fav_pen * pesos.get("pendiente", 0.0), 6),
                   nv_pen or not (peso_pen_nv and peso_pen_nv.verificado), fl_pen),
    ]

    score = round(100.0 * sum(c.aporte for c in comps), 2)
    no_verif = any(c.no_verificado for c in comps)
    flags = sorted({fl for c in comps for fl in c.flags})
    return CeldaProspectividad(
        cell_lat=f.cell_lat, cell_lng=f.cell_lng, cell_size_m=f.cell_size_m,
        score=score, componentes=comps, no_verificado=no_verif, flags=flags,
    )


def a_registro_celda(c: CeldaProspectividad) -> dict:
    """Forma exacta de public.prospectivity_cells (sin project_id/run_id).

    features lleva SIEMPRE la etiqueta obligatoria, el modelo, el desglose por
    componente y las marcas de no verificado — nunca se presenta como recurso.
    """
    return {
        "cell_lat": c.cell_lat,
        "cell_lng": c.cell_lng,
        "cell_size_m": c.cell_size_m,
        "score": c.score,
        "features": {
            "modelo": MODELO,
            "etiqueta": ETIQUETA,
            "no_verificado": c.no_verificado,
            "flags": c.flags,
            "aporte": {cp.factor: cp.aporte for cp in c.componentes},
            "favorabilidad": {cp.factor: cp.favorabilidad for cp in c.componentes},
            "peso": {cp.factor: cp.peso for cp in c.componentes},
        },
    }


def puntuar_grilla(factores: list[FactoresCelda], reglas: Reglas) -> list[CeldaProspectividad]:
    return [puntuar_celda(f, reglas) for f in factores]


def cargar_reglas(cursor) -> Reglas:
    cursor.execute(
        "SELECT grupo, clave, valor, fecha_verificacion FROM public.reglas_prospectividad"
    )
    pesos, lito, params = {}, {}, {}
    for grupo, clave, valor, fecha in cursor.fetchall():
        r = Regla(grupo=grupo, clave=clave,
                  valor=float(valor) if valor is not None else None,
                  fecha_verificacion=str(fecha) if fecha is not None else None)
        if grupo == "peso":
            pesos[clave] = r
        elif grupo == "litologia":
            lito[clave] = r
        elif grupo == "param":
            params[clave] = r
    return Reglas(pesos=pesos, litologia=lito, params=params)
