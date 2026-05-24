import math
import sys
import pathlib

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

from app.desurvey import desurvey  # noqa: E402


def test_vertical_hole_drops_straight_down():
    pts = desurvey(0, 0, 1000, [(0, 0, 90), (100, 0, 90)], step=10)
    assert len(pts) == 11
    assert abs(pts[-1]["x"]) < 1e-6
    assert abs(pts[-1]["y"]) < 1e-6
    assert math.isclose(pts[-1]["z"], 900.0, abs_tol=1e-6)


def test_horizontal_hole_north():
    pts = desurvey(0, 0, 0, [(0, 0, 0), (50, 0, 0)], step=5)
    assert math.isclose(pts[-1]["x"], 50.0, abs_tol=1e-4)
    assert abs(pts[-1]["y"]) < 1e-4
    assert abs(pts[-1]["z"]) < 1e-4
