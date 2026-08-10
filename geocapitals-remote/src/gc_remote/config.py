"""Config del módulo de teledetección Nivel 0.

Esquema estricto del YAML. Regla que manda: NUNCA asumir el CRS. Cada fuente de
coordenadas declara su EPSG y se valida contra pyproj; si falta o es inválido, se
falla ruidosamente (no se adivina). El bbox del AOI se reproyecta a WGS84 y se
verifica que caiga en Chile — un datum equivocado en Chile central desplaza cientos
de metros, así que un bbox fuera de rango es señal de CRS mal declarado.
"""
from __future__ import annotations

import hashlib
from pathlib import Path
from typing import Optional

import pyproj
import yaml
from pydantic import BaseModel, Field, field_validator, model_validator

# Rango continental de Chile (WGS84) para el sanity del AOI.
CHILE_LON = (-76.0, -66.0)
CHILE_LAT = (-56.5, -17.0)


def validate_crs(value: str) -> str:
    """Devuelve el EPSG normalizado o levanta ValueError. No adivina."""
    if not value or not str(value).strip():
        raise ValueError("CRS ausente: declara el EPSG explícito (regla inviolable, no se adivina).")
    try:
        crs = pyproj.CRS.from_user_input(value)
    except Exception as e:  # noqa: BLE001
        raise ValueError(f"CRS inválido '{value}': {e}") from e
    return f"EPSG:{crs.to_epsg()}" if crs.to_epsg() else crs.to_wkt()


class AOI(BaseModel):
    crs: str
    bbox: list[float] = Field(..., min_length=4, max_length=4)  # [xmin, ymin, xmax, ymax]

    @field_validator("crs")
    @classmethod
    def _crs(cls, v: str) -> str:
        return validate_crs(v)

    @model_validator(mode="after")
    def _bbox_ok(self) -> "AOI":
        xmin, ymin, xmax, ymax = self.bbox
        if not (xmin < xmax and ymin < ymax):
            raise ValueError(f"bbox degenerado: {self.bbox}")
        # Reproyectar el centro a WGS84 y verificar que cae en Chile.
        t = pyproj.Transformer.from_crs(self.crs, "EPSG:4326", always_xy=True)
        lon, lat = t.transform((xmin + xmax) / 2, (ymin + ymax) / 2)
        if not (CHILE_LON[0] <= lon <= CHILE_LON[1] and CHILE_LAT[0] <= lat <= CHILE_LAT[1]):
            raise ValueError(
                f"El centro del AOI cae en ({lon:.3f}, {lat:.3f}), fuera de Chile. "
                f"Casi seguro el CRS declarado ({self.crs}) no corresponde al bbox — "
                f"revisa el datum (PSAD56 huso 19 = EPSG:24879, WGS84 UTM 19S = EPSG:32719)."
            )
        return self

    def lonlat_center(self) -> tuple[float, float]:
        xmin, ymin, xmax, ymax = self.bbox
        t = pyproj.Transformer.from_crs(self.crs, "EPSG:4326", always_xy=True)
        return t.transform((xmin + xmax) / 2, (ymin + ymax) / 2)

    def bbox_wgs84(self) -> list[float]:
        """bbox reproyectado a WGS84 (para la búsqueda STAC)."""
        xmin, ymin, xmax, ymax = self.bbox
        t = pyproj.Transformer.from_crs(self.crs, "EPSG:4326", always_xy=True)
        lons, lats = [], []
        for x in (xmin, xmax):
            for y in (ymin, ymax):
                lo, la = t.transform(x, y)
                lons.append(lo); lats.append(la)
        return [min(lons), min(lats), max(lons), max(lats)]


class Seasons(BaseModel):
    months: list[int] = Field(default=[2, 3, 4])   # fin de verano austral por defecto
    years: list[int]
    max_cloud_pct: float = 10.0

    @field_validator("months")
    @classmethod
    def _m(cls, v: list[int]) -> list[int]:
        if any(m < 1 or m > 12 for m in v):
            raise ValueError("months fuera de 1..12")
        return v


class Masks(BaseModel):
    ndvi_threshold: float = 0.25
    # Umbrales adicionales de sensibilidad que reporta coverage.
    ndvi_sensitivity: list[float] = Field(default=[0.20, 0.25, 0.30])


class ValidationPoints(BaseModel):
    crs: str
    position_uncertainty_m: float
    path: Optional[str] = None
    positive_control_ids: list[str] = Field(default_factory=list)

    @field_validator("crs")
    @classmethod
    def _crs(cls, v: str) -> str:
        return validate_crs(v)


class Structure(BaseModel):
    known_strikes_deg: list[float] = Field(default_factory=list)
    min_lineament_length_m: float = 150.0


class Cadastre(BaseModel):
    source: str = "sernageomin_wfs"
    buffer_m: float = 60.0


class Config(BaseModel):
    name: str
    aoi: AOI
    output_crs: str
    seasons: Seasons
    masks: Masks = Field(default_factory=Masks)
    validation_points: Optional[ValidationPoints] = None
    structure: Structure = Field(default_factory=Structure)
    cadastre: Cadastre = Field(default_factory=Cadastre)

    # Provenance: hash del texto crudo del YAML (reproducibilidad / trazabilidad).
    config_sha256: Optional[str] = None

    @field_validator("output_crs")
    @classmethod
    def _ocrs(cls, v: str) -> str:
        return validate_crs(v)

    @classmethod
    def from_yaml(cls, path: str | Path) -> "Config":
        text = Path(path).read_text(encoding="utf-8")
        data = yaml.safe_load(text) or {}
        cfg = cls.model_validate(data)
        cfg.config_sha256 = hashlib.sha256(text.encode("utf-8")).hexdigest()
        return cfg
