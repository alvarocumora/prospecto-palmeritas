import unittest

from fastapi import HTTPException

import api


class AuthorizationTests(unittest.TestCase):
    def setUp(self):
        self.previous = api.AUTH_TOKEN
        api.AUTH_TOKEN = "test-node-secret"

    def tearDown(self):
        api.AUTH_TOKEN = self.previous

    def test_requires_bearer_prefix(self):
        for value in (None, "test-node-secret", "Bearer wrong"):
            with self.subTest(value=value), self.assertRaises(HTTPException) as error:
                api._authorize(value)
            self.assertEqual(error.exception.status_code, 401)

    def test_accepts_configured_bearer_token(self):
        api._authorize("Bearer test-node-secret")

    def test_refuses_to_run_without_configured_secret(self):
        api.AUTH_TOKEN = ""
        with self.assertRaises(HTTPException) as error:
            api._authorize("Bearer test-node-secret")
        self.assertEqual(error.exception.status_code, 503)


if __name__ == "__main__":
    unittest.main()
