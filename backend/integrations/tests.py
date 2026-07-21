from unittest.mock import Mock, patch

from django.test import SimpleTestCase, override_settings

from integrations.services.validation import GEMINI_IMAGE_MODEL, validate_gemini_key
from integrations.models import AIProviderConnection
from integrations.services.encryption import encrypt_api_key
from integrations.services.models import available_provider_models


class GeminiKeyValidationTests(SimpleTestCase):
    @override_settings(ENABLE_PROVIDER_KEY_REMOTE_VALIDATION=True)
    @patch("integrations.services.validation.requests.get")
    def test_validates_key_against_image_model(self, request_get):
        request_get.return_value = Mock(status_code=200)

        result = validate_gemini_key("AIza-valid-test-key-123456789")

        self.assertTrue(result["valid"])
        self.assertEqual(result["model"], GEMINI_IMAGE_MODEL)
        requested_url = request_get.call_args.args[0]
        self.assertIn(GEMINI_IMAGE_MODEL, requested_url)

    @override_settings(ENABLE_PROVIDER_KEY_REMOTE_VALIDATION=True)
    @patch("integrations.services.validation.requests.get")
    def test_reports_missing_image_model_access(self, request_get):
        request_get.return_value = Mock(status_code=404)

        result = validate_gemini_key("AIza-valid-test-key-123456789")

        self.assertFalse(result["valid"])
        self.assertIn("modelo de imagen", result["error"])

    @override_settings(API_KEY_ENCRYPTION_SECRET="MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=")
    @patch("integrations.services.models.requests.get")
    def test_lists_only_image_models_accessible_to_the_key(self, request_get):
        response = Mock()
        response.json.return_value = {
            "models": [
                {"name": "models/gemini-3.1-flash-image", "supportedGenerationMethods": ["generateContent"]},
                {"name": "models/gemini-3-pro-image", "supportedGenerationMethods": ["generateContent"]},
                {"name": "models/gemini-3.5-flash", "supportedGenerationMethods": ["generateContent"]},
            ]
        }
        request_get.return_value = response
        connection = AIProviderConnection(
            provider="gemini",
            encrypted_api_key=encrypt_api_key("AIza-valid-test-key-123456789"),
        )

        result = available_provider_models(connection)

        self.assertEqual(
            [item["code"] for item in result],
            ["gemini-3.1-flash-image", "gemini-3-pro-image"],
        )
