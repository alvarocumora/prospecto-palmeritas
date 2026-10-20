"""KML/KMZ → WGS84 GeoJSON preview; no remote fetch and no persistence.

KML coordinates are explicitly WGS84 longitude,latitude[,altitude].
Altitude is excluded because the uploaded file may use a relative/clamped
vertical reference and the project's vertical datum is not established.
"""
from __future__ import annotations

import io
import math
import posixpath
import stat
import zipfile
from pathlib import PurePosixPath
from xml.etree.ElementTree import ParseError

from defusedxml.ElementTree import fromstring
from defusedxml.common import DefusedXmlException
from shapely.geometry import GeometryCollection, LineString, Point, Polygon, mapping

MAX_UPLOAD_BYTES = 8 * 1024 * 1024
MAX_UNCOMPRESSED_BYTES = 32 * 1024 * 1024
MAX_ZIP_MEMBERS = 64
MAX_FEATURES = 5000
MAX_COORDINATES = 250000


def _local(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def _coordinates(node, state: dict) -> list[tuple[float, float]]:
    content = next(
        (child.text for child in node.iter() if _local(child.tag) == "coordinates"),
        None,
    )
    if not content or not content.strip():
        raise ValueError("geometry_coordinates_missing")

    result = []
    for entry in content.split():
        raw = entry.split(",")
        if len(raw) not in (2, 3):
            raise ValueError("invalid_kml_coordinate_tuple")
        try:
            values = [float(part) for part in raw]
        except ValueError as exc:
            raise ValueError("invalid_kml_coordinate_value") from exc
        lon, lat = values[0], values[1]
        if not (math.isfinite(lon) and math.isfinite(lat) and -180 <= lon <= 180 and -90 <= lat <= 90):
            raise ValueError("kml_coordinate_out_of_range")
        if len(values) == 3:
            if not math.isfinite(values[2]):
                raise ValueError("invalid_kml_altitude")
            state["altitude_ignored"] = True
        state["coordinates"] += 1
        if state["coordinates"] > MAX_COORDINATES:
            raise ValueError("too_many_coordinates")
        result.append((lon, lat))
    return result


def _polygon(node, state: dict) -> Polygon:
    outer = None
    holes = []
    for child in node.iter():
        section = _local(child.tag)
        if section not in ("outerBoundaryIs", "innerBoundaryIs"):
            continue
        rings = [ring for ring in child.iter() if _local(ring.tag) == "LinearRing"]
        if len(rings) != 1:
            raise ValueError("invalid_kml_polygon_boundary")
        coords = _coordinates(rings[0], state)
        if len(coords) < 4 or coords[0] != coords[-1]:
            raise ValueError("unclosed_or_short_kml_ring")
        if section == "outerBoundaryIs":
            if outer is not None:
                raise ValueError("multiple_outer_rings")
            outer = coords
        else:
            holes.append(coords)
    if outer is None:
        raise ValueError("kml_polygon_outer_ring_missing")
    return Polygon(outer, holes)


def _geometry(node, state: dict):
    kind = _local(node.tag)
    if kind == "Point":
        coords = _coordinates(node, state)
        if len(coords) != 1:
            raise ValueError("invalid_kml_point")
        return Point(coords[0])
    if kind == "LineString":
        coords = _coordinates(node, state)
        if len(coords) < 2:
            raise ValueError("short_kml_line")
        return LineString(coords)
    if kind == "Polygon":
        return _polygon(node, state)
    if kind == "MultiGeometry":
        geoms = [
            parsed
            for child in node
            if (parsed := _geometry(child, state)) is not None
        ]
        if not geoms:
            raise ValueError("empty_kml_multigeometry")
        return GeometryCollection(geoms)
    return None


def _sanitize_zip(zipped: zipfile.ZipFile) -> bytes:
    members = zipped.infolist()
    if len(members) > MAX_ZIP_MEMBERS:
        raise ValueError("too_many_kmz_members")
    total_size = 0
    kml_entries: list[zipfile.ZipInfo] = []
    for info in members:
        path = info.filename.replace("\\", "/")
        parts = PurePosixPath(path).parts
        if (
            not path
            or path.startswith("/")
            or any(part in (".", "..") for part in parts)
            or posixpath.normpath(path).startswith("../")
            or (len(path) >= 2 and path[1] == ":")
            or stat.S_ISLNK(info.external_attr >> 16)
            or info.flag_bits & 0x1
        ):
            raise ValueError("unsafe_kmz_member")
        if info.file_size < 0 or info.file_size > MAX_UNCOMPRESSED_BYTES:
            raise ValueError("kmz_member_too_large")
        total_size += info.file_size
        if total_size > MAX_UNCOMPRESSED_BYTES:
            raise ValueError("kmz_uncompressed_size_exceeded")
        if path.lower().endswith(".kml") and not info.is_dir():
            kml_entries.append(info)

    if len(kml_entries) != 1:
        raise ValueError("kmz_requires_one_kml_document")
    with zipped.open(kml_entries[0]) as stream:
        document = stream.read(MAX_UNCOMPRESSED_BYTES + 1)
    if len(document) > MAX_UNCOMPRESSED_BYTES:
        raise ValueError("kmz_xml_size_exceeded")
    return document


def _read_document(filename: str, payload: bytes) -> bytes:
    if len(payload) > MAX_UPLOAD_BYTES:
        raise ValueError("upload_size_exceeded")
    suffix = PurePosixPath(filename.lower()).suffix
    if suffix == ".kml":
        return payload
    if suffix == ".kmz":
        try:
            with zipfile.ZipFile(io.BytesIO(payload)) as zipped:
                return _sanitize_zip(zipped)
        except (zipfile.BadZipFile, RuntimeError) as exc:
            raise ValueError("invalid_kmz_archive") from exc
    raise ValueError("unsupported_extension_use_kml_or_kmz")


def preview_kml(filename: str, payload: bytes) -> dict:
    """Return a bounded, non-persistent GeoJSON FeatureCollection for review."""
    xml = _read_document(filename, payload)
    try:
        root = fromstring(xml, forbid_dtd=True, forbid_entities=True, forbid_external=True)
    except (DefusedXmlException, ParseError) as exc:
        raise ValueError("unsafe_or_invalid_kml_xml") from exc
    if _local(root.tag) != "kml":
        raise ValueError("kml_root_required")

    features = []
    state = {"coordinates": 0, "altitude_ignored": False}
    for placemark in root.iter():
        if _local(placemark.tag) != "Placemark":
            continue
        title = next(
            (child.text for child in placemark if _local(child.tag) == "name"),
            None,
        )
        geometries = []
        for child in placemark:
            geo = _geometry(child, state)
            if geo is not None:
                geometries.append(geo)
        for geometry in geometries:
            if geometry.is_empty or not geometry.is_valid:
                raise ValueError("invalid_kml_geometry")
            features.append({
                "type": "Feature",
                "geometry": mapping(geometry),
                "properties": {
                    "name": (title or "").strip()[:160],
                    "source": "uploaded_kml_unverified",
                },
            })
            if len(features) > MAX_FEATURES:
                raise ValueError("too_many_features")

    if not features:
        raise ValueError("kml_no_supported_geometries")
    return {
        "type": "FeatureCollection",
        "features": features,
        "source_crs": "EPSG:4326",
        "status": "preview_unverified",
        "coordinate_count": state["coordinates"],
        "warnings": (
            ["Altitude dropped: vertical datum / altitudeMode not verified."]
            if state["altitude_ignored"]
            else []
        ),
    }
