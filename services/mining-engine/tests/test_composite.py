"""Tests para composite."""
from app.composite import composite_intervals


def test_uniform_intervals_length_1():
    # 4 intervalos de 1m con valores 1,2,3,4 → compuesto length=2 debe dar 1.5, 3.5
    intervals = [
        {"from": 0, "to": 1, "values": {"au": 1.0}},
        {"from": 1, "to": 2, "values": {"au": 2.0}},
        {"from": 2, "to": 3, "values": {"au": 3.0}},
        {"from": 3, "to": 4, "values": {"au": 4.0}},
    ]
    out = composite_intervals(intervals, length=2.0)
    assert len(out) == 2
    assert abs(out[0]["values"]["au"] - 1.5) < 1e-9
    assert abs(out[1]["values"]["au"] - 3.5) < 1e-9
    assert out[0]["recovery"] == 1.0


def test_handles_gaps_and_recovery():
    # Gap entre 1-2, debe afectar recovery
    intervals = [
        {"from": 0, "to": 1, "values": {"au": 2.0}},
        {"from": 2, "to": 3, "values": {"au": 4.0}},
    ]
    out = composite_intervals(intervals, length=3.0, start=0, end=3, min_recovery=0.5)
    assert len(out) == 1
    # 2 metros cubiertos de 3 → recovery = 0.667
    assert abs(out[0]["recovery"] - 2/3) < 1e-6
    # promedio ponderado: (2*1 + 4*1)/2 = 3
    assert abs(out[0]["values"]["au"] - 3.0) < 1e-9


def test_min_recovery_filters():
    intervals = [{"from": 0, "to": 0.2, "values": {"au": 10.0}}]
    out = composite_intervals(intervals, length=2.0, start=0, end=2, min_recovery=0.5)
    assert out[0]["values"]["au"] is None  # recovery=0.1 < 0.5
