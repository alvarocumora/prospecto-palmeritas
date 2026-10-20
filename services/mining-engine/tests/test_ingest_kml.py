"""KML/KMZ parser must reject unsafe inputs before accepting geometries."""
import io
import zipfile

import pytest

from app.ingest.kml import preview_kml

KML = b"""<?xml version="1.0"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
<Document><Placemark><name>Concesion ilustrativa</name>
<Polygon><outerBoundaryIs><LinearRing><coordinates>
-70.1,-33.1,100 -70.0,-33.1,100 -70.0,-33.0,100
-70.1,-33.0,100 -70.1,-33.1,100
</coordinates></LinearRing></outerBoundaryIs></Polygon>
</Placemark></Document></kml>"""


def _zip_with(entries):
    memory = io.BytesIO()
    with zipfile.ZipFile(memory, "w", zipfile.ZIP_DEFLATED) as out:
        for name, payload in entries.items():
            out.writestr(name, payload)
    return memory.getvalue()


def test_parse_kml_polygon_as_wgs84_geojson_preview():
    result = preview_kml("concession.kml", KML)
    assert result["type"] == "FeatureCollection"
    assert result["source_crs"] == "EPSG:4326"
    assert result["status"] == "preview_unverified"
    assert result["features"][0]["geometry"]["type"] == "Polygon"
    assert result["features"][0]["properties"]["source"] == "uploaded_kml_unverified"
    assert len(result["warnings"]) == 1


def test_safe_kmz_roundtrip():
    result = preview_kml("terrain.kmz", _zip_with({"doc.kml": KML}))
    assert len(result["features"]) == 1


@pytest.mark.parametrize("filename", ["../doc.kml", "/doc.kml", "C:/temp/doc.kml"])
def test_reject_kmz_zip_slip_paths(filename):
    with pytest.raises(ValueError, match="unsafe_kmz_member"):
        preview_kml("input.kmz", _zip_with({filename: KML}))


def test_reject_multiple_kml_documents():
    with pytest.raises(ValueError, match="kmz_requires_one_kml_document"):
        preview_kml("multi.kmz", _zip_with({"a.kml": KML, "b.kml": KML}))


def test_reject_dtd_and_entity_expansion():
    data = b'<!DOCTYPE kml [<!ENTITY leak SYSTEM "file:///etc/passwd">]><kml>&leak;</kml>'
    with pytest.raises(ValueError, match="unsafe_or_invalid_kml_xml"):
        preview_kml("malicious.kml", data)


def test_reject_out_of_range_coordinates():
    invalid = KML.replace(b"-70.1,-33.1,100", b"200,-33.1,100")
    with pytest.raises(ValueError, match="kml_coordinate_out_of_range"):
        preview_kml("invalid.kml", invalid)


def test_reject_unclosed_polygon():
    invalid = KML.replace(b"-70.1,-33.1,100 -70.0", b"-70.2,-33.1,100 -70.0")
    with pytest.raises(ValueError, match="unclosed_or_short_kml_ring"):
        preview_kml("unclosed.kml", invalid)


def test_reject_unsupported_extension_and_empty():
    with pytest.raises(ValueError, match="unsupported_extension"):
        preview_kml("drawing.dxf", KML)
    with pytest.raises(ValueError):
        preview_kml("empty.kml", b"")


def test_kml_network_links_do_not_trigger_remote_fetch():
    data = b"""<kml xmlns="http://www.opengis.net/kml/2.2">
    <NetworkLink><Link><href>http://127.0.0.1/secret</href></Link></NetworkLink>
    </kml>"""
    with pytest.raises(ValueError, match="kml_no_supported_geometries"):
        preview_kml("network.kml", data)
