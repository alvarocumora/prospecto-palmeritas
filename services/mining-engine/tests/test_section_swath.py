from app.section import project_trajectory, project_points
from app.swath import swath_compare


def test_project_trajectory_vertical_east():
    pts = [
        {"md": 0, "x": 0, "y": 0, "z": 100},
        {"md": 50, "x": 30, "y": 0, "z": 50},
        {"md": 100, "x": 60, "y": 0, "z": 0},
    ]
    r = project_trajectory(pts, 0, 0, 100, 90, band_m=10)
    assert all(p["in_band"] for p in r)
    assert r[2]["s"] == 60
    assert r[2]["h"] == -100


def test_project_trajectory_out_of_band():
    pts = [{"md": 0, "x": 0, "y": 50, "z": 0}]
    r = project_trajectory(pts, 0, 0, 0, 90, band_m=10)
    assert not r[0]["in_band"]


def test_project_points_filters_band():
    pts = [
        {"x": 0, "y": 0, "z": 0, "id": "a"},
        {"x": 0, "y": 100, "z": 0, "id": "b"},
    ]
    r = project_points(pts, 0, 0, 0, 90, band_m=10)
    assert len(r) == 1
    assert r[0]["id"] == "a"


def test_swath_basic():
    comp = [{"x": 0, "y": 0, "z": i * 10, "grade": 1.0 + i * 0.1} for i in range(10)]
    blk = [{"x": 0, "y": 0, "z": i * 10, "grade": 0.9 + i * 0.11} for i in range(10)]
    r = swath_compare(comp, blk, "z", 3)
    assert r["axis"] == "z"
    assert len(r["bands"]) == 3
    assert all(b["mean_composites"] is not None for b in r["bands"])
