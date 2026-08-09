import json
from unittest.mock import (
    Mock,
    patch,
)

from django.test import (
    TestCase,
    override_settings,
)
from rest_framework.test import APIClient

from accounts.models import (
    User,
    Workspace,
    WorkspaceMember,
)
from billing.models import (
    Plan,
    Subscription,
)
from integrations.models import (
    AIProviderConnection,
)
from integrations.services.encryption import (
    encrypt_api_key,
)
from studio.models import (
    BrandIntelligenceProfile,
    BrandKit,
)


@override_settings(
    API_KEY_ENCRYPTION_SECRET=("MDEyMzQ1Njc4OWFiY2RlZjAxMjM0" "NTY3ODlhYmNkZWY="),
    GEMINI_BRAND_INTELLIGENCE_MODEL=("gemini-2.5-pro"),
    GEMINI_BRAND_INTELLIGENCE_TIMEOUT=30,
)
class BrandIntelligenceTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email=("brand-intelligence@example.com"),
            password="StrongPass!2026",
            status="active",
        )

        self.workspace = Workspace.objects.create(
            name="Brand Intelligence",
            slug="brand-intelligence",
            workspace_type="individual",
            owner=self.user,
        )

        WorkspaceMember.objects.create(
            workspace=self.workspace,
            user=self.user,
            role="owner",
            is_active=True,
        )

        plan = Plan.objects.create(
            name="Brand Intelligence Plan",
            max_members=1,
        )

        Subscription.objects.create(
            workspace=self.workspace,
            plan=plan,
            status="active",
        )

        self.brand_kit = BrandKit.objects.create(
            workspace=self.workspace,
            brand_name="Ascend",
            brand_description=("Plataforma de creación " "publicitaria."),
            tone_of_voice=("Profesional, claro " "y estratégico."),
        )

        self.connection = AIProviderConnection.objects.create(
            workspace=self.workspace,
            provider="gemini",
            encrypted_api_key=(encrypt_api_key("AIza-brand-intelligence-test")),
            status="active",
            is_default=True,
            created_by=self.user,
        )

        self.client = APIClient()

        self.client.force_authenticate(self.user)

        self.headers = {
            "HTTP_X_WORKSPACE_ID": (str(self.workspace.id)),
        }

    def profiles_payload(
        self,
        count=3,
    ):
        return {
            "profiles": [
                {
                    "persona": (f"Perfil {index}"),
                    "pain_point": (f"Problema {index}"),
                    "angle": (f"Ángulo {index}"),
                    "visual_direction": (f"Dirección visual {index}"),
                    "emotion": (f"Emoción {index}"),
                    "copy_hook": (f"Hook {index}"),
                }
                for index in range(
                    1,
                    count + 1,
                )
            ]
        }

    def gemini_response(
        self,
        payload,
    ):
        response = Mock()

        response.status_code = 200
        response.ok = True

        response.json.return_value = {
            "candidates": [
                {
                    "content": {
                        "parts": [
                            {
                                "text": json.dumps(
                                    payload,
                                    ensure_ascii=False,
                                )
                            }
                        ]
                    }
                }
            ]
        }

        return response

    def test_create_manual_profile(self):
        response = self.client.post(
            "/api/studio/brand-intelligence/",
            {
                "persona": ("Dueño de pequeña empresa"),
                "pain_point": ("No tiene tiempo"),
                "angle": ("Ahorro de tiempo"),
                "visual_direction": ("Escena profesional"),
                "emotion": "Alivio",
                "copy_hook": ("Recupera tus horas"),
                "is_active": True,
            },
            format="json",
            **self.headers,
        )

        self.assertEqual(
            response.status_code,
            201,
            response.data,
        )

    def test_workspace_isolation(self):
        BrandIntelligenceProfile.objects.create(
            workspace=self.workspace,
            persona="Principal",
            pain_point="Problema",
            angle="Ángulo",
        )

        other = Workspace.objects.create(
            name="Other",
            slug="other-bi",
            workspace_type="individual",
            owner=self.user,
        )

        BrandIntelligenceProfile.objects.create(
            workspace=other,
            persona="Externo",
            pain_point="Problema",
            angle="Ángulo",
        )

        response = self.client.get(
            "/api/studio/brand-intelligence/",
            **self.headers,
        )

        results = response.data.get(
            "results",
            response.data,
        )

        self.assertEqual(
            len(results),
            1,
        )

        self.assertEqual(
            results[0]["persona"],
            "Principal",
        )

    def test_generate_requires_notes(self):
        response = self.client.post(
            ("/api/studio/" "brand-intelligence/generate/"),
            {
                "research_notes": "",
                "number_of_profiles": 3,
            },
            format="json",
            **self.headers,
        )

        self.assertEqual(
            response.status_code,
            400,
        )

    @patch("studio.services." "brand_intelligence.requests.post")
    def test_generate_profiles(
        self,
        request_post,
    ):
        request_post.return_value = self.gemini_response(self.profiles_payload(3))

        response = self.client.post(
            ("/api/studio/" "brand-intelligence/generate/"),
            {
                "research_notes": (
                    "Nuestros clientes son pequeñas "
                    "empresas que buscan acelerar "
                    "la creación publicitaria."
                ),
                "number_of_profiles": 3,
                "replace_existing": False,
            },
            format="json",
            **self.headers,
        )

        self.assertEqual(
            response.status_code,
            201,
            response.data,
        )

        self.assertEqual(
            response.data["count"],
            3,
        )

        self.assertEqual(
            BrandIntelligenceProfile.objects.filter(
                workspace=self.workspace,
                is_active=True,
            ).count(),
            3,
        )

    @patch("studio.services." "brand_intelligence.requests.post")
    def test_replace_existing_profiles(
        self,
        request_post,
    ):
        old = BrandIntelligenceProfile.objects.create(
            workspace=self.workspace,
            persona="Antiguo",
            pain_point="Problema",
            angle="Ángulo",
            is_active=True,
        )

        request_post.return_value = self.gemini_response(self.profiles_payload(2))

        response = self.client.post(
            ("/api/studio/" "brand-intelligence/generate/"),
            {
                "research_notes": (
                    "Investigación suficientemente " "extensa para generar perfiles."
                ),
                "number_of_profiles": 2,
                "replace_existing": True,
            },
            format="json",
            **self.headers,
        )

        self.assertEqual(
            response.status_code,
            201,
        )

        old.refresh_from_db()

        self.assertFalse(old.is_active)

        self.assertEqual(
            BrandIntelligenceProfile.objects.filter(
                workspace=self.workspace,
                is_active=True,
            ).count(),
            2,
        )

    @patch("studio.services." "brand_intelligence.requests.post")
    def test_rejects_wrong_profile_count(
        self,
        request_post,
    ):
        request_post.return_value = self.gemini_response(self.profiles_payload(2))

        response = self.client.post(
            ("/api/studio/" "brand-intelligence/generate/"),
            {
                "research_notes": (
                    "Investigación suficientemente " "extensa para generar perfiles."
                ),
                "number_of_profiles": 3,
            },
            format="json",
            **self.headers,
        )

        self.assertEqual(
            response.status_code,
            400,
        )

        self.assertEqual(
            BrandIntelligenceProfile.objects.filter(workspace=self.workspace).count(),
            0,
        )
