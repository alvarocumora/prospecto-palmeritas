import copy
import unittest

from runner import ContractError, build_mesh, validate_payload

import numpy as np


def payload():
    return {
        "schema_version": "1",
        "job_id": "job-test",
        "project_id": "project-test",
        "crs": "EPSG:32719",
        "observations": [
            {"x_m": 0, "y_m": 0, "z_m": 10, "tmi_nt": 1, "std_nt": 1},
            {"x_m": 20, "y_m": 0, "z_m": 10, "tmi_nt": 2, "std_nt": 1},
            {"x_m": 0, "y_m": 20, "z_m": 10, "tmi_nt": 3, "std_nt": 1},
            {"x_m": 20, "y_m": 20, "z_m": 10, "tmi_nt": 4, "std_nt": 1},
        ],
        "topography": [
            {"x_m": -10, "y_m": -10, "z_m": 0},
            {"x_m": 30, "y_m": -10, "z_m": 0},
            {"x_m": -10, "y_m": 30, "z_m": 0},
            {"x_m": 30, "y_m": 30, "z_m": 0},
        ],
        "inducing_field": {
            "amplitude_nt": 50000,
            "inclination_deg": -30,
            "declination_deg": 5,
        },
        "mesh": {"cell_size_m": 10, "padding_m": 10, "depth_m": 30, "max_cells": 10000},
        "inversion": {
            "max_iterations": 2,
            "lower_bound_si": 0,
            "upper_bound_si": 1,
            "starting_susceptibility_si": 0.0001,
        },
    }


class ContractTests(unittest.TestCase):
    def test_valid_payload(self):
        validate_payload(payload())

    def test_rejects_wgs84(self):
        item = payload()
        item["crs"] = "EPSG:4326"
        with self.assertRaisesRegex(ContractError, "projected metric CRS"):
            validate_payload(item)

    def test_rejects_synthetic_bad_uncertainty_shape(self):
        item = payload()
        item["observations"][0]["std_nt"] = 0
        with self.assertRaisesRegex(ContractError, "std_nt must be > 0"):
            validate_payload(item)

    def test_mesh_guard(self):
        item = payload()
        item["mesh"]["cell_size_m"] = 0.1
        locations = np.asarray(
            [[o["x_m"], o["y_m"], o["z_m"]] for o in item["observations"]], dtype=float
        )
        topo = np.asarray(
            [[p["x_m"], p["y_m"], p["z_m"]] for p in item["topography"]], dtype=float
        )
        with self.assertRaisesRegex(ContractError, "exceeding max_cells"):
            build_mesh(item, locations, topo)

    def test_rejects_start_outside_bounds(self):
        item = copy.deepcopy(payload())
        item["inversion"]["starting_susceptibility_si"] = 2
        with self.assertRaisesRegex(ContractError, "within inversion bounds"):
            validate_payload(item)


if __name__ == "__main__":
    unittest.main()
