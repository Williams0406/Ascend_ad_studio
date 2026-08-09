import json
from unittest.mock import (
    Mock,
    patch,
)

from django.test import (
    TestCase,
    override_settings,
)
from rest_framework.test import (
    APIClient,
)

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
    AdTemplate,
    BrandIntelligenceProfile,
    ConceptPlan,
    AdProject,
)


@override_settings(
    API_KEY_ENCRYPTION_SECRET=("MDEyMzQ1Njc4OWFiY2RlZjAxMjM0" "NTY3ODlhYmNkZWY="),
    GEMINI_CONCEPT_PLANNER_MODEL=("gemini-2.5-pro"),
    GEMINI_CONCEPT_PLANNER_TIMEOUT=30,
)
class ConceptPlannerTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="planner@example.com",
            password="StrongPass!2026",
            status="active",
        )

        self.workspace = Workspace.objects.create(
            name="Planner",
            slug="planner",
            workspace_type="individual",
            owner=self.user,
        )

        self.project = AdProject.objects.create(
            workspace=self.workspace,
            created_by=self.user,
            name="Proyecto Planner",
            status="draft",
        )

        WorkspaceMember.objects.create(
            workspace=self.workspace,
            user=self.user,
            role="owner",
            is_active=True,
        )

        plan = Plan.objects.create(
            name="Planner plan",
            max_members=1,
        )

        Subscription.objects.create(
            workspace=self.workspace,
            plan=plan,
            status="active",
        )

        self.connection = AIProviderConnection.objects.create(
            workspace=self.workspace,
            provider="gemini",
            encrypted_api_key=(encrypt_api_key("AIza-planner-test")),
            status="active",
            is_default=True,
            created_by=self.user,
        )

        self.profiles = [
            BrandIntelligenceProfile.objects.create(
                workspace=self.workspace,
                persona=(f"Persona real {index}"),
                pain_point=(f"Problema real {index}"),
                angle=(f"Ángulo real {index}"),
                emotion=(f"Emoción real {index}"),
                visual_direction=(f"Dirección real {index}"),
                copy_hook=(f"Hook base {index}"),
            )
            for index in range(
                1,
                4,
            )
        ]

        self.templates = [
            AdTemplate.objects.create(
                workspace=self.workspace,
                name=(f"Plantilla {index}"),
                format=("instagram_post_portrait"),
                layout_constraints={
                    "canvas_mode": "single",
                    "allow_split_screen": False,
                    "allow_collage": False,
                },
                description=(f"Descripción {index}"),
                visual_structure=(f"Estructura {index}"),
                copy_structure=(f"Copy structure {index}"),
                prompt_guidance=(f"Prompt guidance {index}"),
                do_rules=[
                    f"Do {index}",
                ],
                dont_rules=[
                    f"Don't {index}",
                ],
                created_by=self.user,
            )
            for index in range(
                1,
                5,
            )
        ]

        self.client = APIClient()

        self.client.force_authenticate(self.user)

        self.headers = {
            "HTTP_X_WORKSPACE_ID": (str(self.workspace.id)),
        }

    def gemini_concepts(
        self,
        count,
    ):
        return {
            "concepts": [
                {
                    "ad_template_id": str(self.templates[index].id),
                    "profile_id": str(self.profiles[index % len(self.profiles)].id),
                    "hook_variants": [
                        (f"Hook comercial " f"{index + 1} A"),
                        (f"Hook comercial " f"{index + 1} B"),
                    ],
                    "body_copy_primary": (f"Body principal " f"{index + 1}"),
                    "body_copy_variant_a": (f"Body variante " f"{index + 1}"),
                    "cta": (f"CTA {index + 1}"),
                    "visual_direction": (f"Dirección generada " f"{index + 1}"),
                    "rationale": (f"Rationale " f"{index + 1}"),
                }
                for index in range(count)
            ]
        }

    def response_with_payload(
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

    @patch("studio.services." "concept_planner.requests.post")
    def test_creates_exact_number_of_concepts(
        self,
        request_post,
    ):
        request_post.return_value = self.response_with_payload(self.gemini_concepts(3))

        response = self.client.post(
            "/api/studio/concept-plans/",
            {
                "project_id": str(self.project.id),
                "total_ads_requested": 3,
                "profile_ids": [str(profile.id) for profile in self.profiles],
                "template_ids": [str(template.id) for template in self.templates],
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
            len(response.data["concepts"]),
            3,
        )

        self.assertEqual(
            request_post.call_count,
            1,
        )

    @patch("studio.services." "concept_planner.requests.post")
    def test_concept_count_never_exceeds_templates(
        self,
        request_post,
    ):
        request_post.return_value = self.response_with_payload(self.gemini_concepts(4))

        response = self.client.post(
            "/api/studio/concept-plans/",
            {
                "project_id": str(self.project.id),
                "total_ads_requested": 10,
                "profile_ids": [str(profile.id) for profile in self.profiles],
                "template_ids": [str(template.id) for template in self.templates],
            },
            format="json",
            **self.headers,
        )

        self.assertEqual(
            response.status_code,
            201,
            response.data,
        )

        concepts = response.data["concepts"]

        self.assertEqual(
            len(concepts),
            4,
        )

        self.assertEqual(
            sum(concept["ads_count"] for concept in concepts),
            10,
        )

    @patch("studio.services." "concept_planner.requests.post")
    def test_templates_are_unique(
        self,
        request_post,
    ):
        request_post.return_value = self.response_with_payload(self.gemini_concepts(4))

        response = self.client.post(
            "/api/studio/concept-plans/",
            {
                "project_id": str(self.project.id),
                "total_ads_requested": 8,
                "profile_ids": [str(profile.id) for profile in self.profiles],
                "template_ids": [str(template.id) for template in self.templates],
            },
            format="json",
            **self.headers,
        )

        concepts = response.data["concepts"]

        template_ids = [concept["ad_template_id"] for concept in concepts]

        self.assertEqual(
            len(template_ids),
            len(set(template_ids)),
        )

    @patch("studio.services." "concept_planner.requests.post")
    def test_rehydrates_profile_data_from_database(
        self,
        request_post,
    ):
        payload = self.gemini_concepts(1)

        payload["concepts"][0]["persona"] = "PERSONA ALUCINADA"

        payload["concepts"][0]["pain_point"] = "PAIN ALUCINADO"

        request_post.return_value = self.response_with_payload(payload)

        response = self.client.post(
            "/api/studio/concept-plans/",
            {
                "project_id": str(self.project.id),
                "total_ads_requested": 1,
                "profile_ids": [str(self.profiles[0].id)],
                "template_ids": [str(self.templates[0].id)],
            },
            format="json",
            **self.headers,
        )

        concept = response.data["concepts"][0]

        self.assertEqual(
            concept["persona"],
            self.profiles[0].persona,
        )

        self.assertEqual(
            concept["pain_point"],
            self.profiles[0].pain_point,
        )

    @patch("studio.services." "concept_planner.requests.post")
    def test_duplicate_template_is_filled_by_fallback(
        self,
        request_post,
    ):
        duplicated = self.gemini_concepts(2)

        duplicated["concepts"][1]["ad_template_id"] = duplicated["concepts"][0][
            "ad_template_id"
        ]

        request_post.return_value = self.response_with_payload(duplicated)

        response = self.client.post(
            "/api/studio/concept-plans/",
            {
                "project_id": str(self.project.id),
                "total_ads_requested": 2,
                "profile_ids": [str(profile.id) for profile in self.profiles],
                "template_ids": [str(template.id) for template in self.templates],
            },
            format="json",
            **self.headers,
        )

        concepts = response.data["concepts"]

        self.assertEqual(
            len(concepts),
            2,
        )

        self.assertEqual(
            len({concept["ad_template_id"] for concept in concepts}),
            2,
        )

        self.assertEqual(
            response.data["summary"]["fallback_concepts"],
            1,
        )

    @patch("studio.services." "concept_planner.requests.post")
    def test_gemini_failure_uses_fallback(
        self,
        request_post,
    ):
        request_post.side_effect = Exception("No debería propagarse")

        # requests.post es interceptado antes de requests.RequestException
        # si usamos Exception genérica, así que simulamos mejor un
        # RequestException real.
        import requests

        request_post.side_effect = requests.RequestException("Gemini caído")

        response = self.client.post(
            "/api/studio/concept-plans/",
            {
                "project_id": str(self.project.id),
                "total_ads_requested": 6,
                "profile_ids": [str(profile.id) for profile in self.profiles],
                "template_ids": [str(template.id) for template in self.templates],
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
            response.data["summary"]["planner_mode"],
            "fallback",
        )

        self.assertEqual(
            sum(concept["ads_count"] for concept in response.data["concepts"]),
            6,
        )

        self.assertTrue(
            all(
                concept["body_copy_primary"] == ""
                for concept in response.data["concepts"]
            )
        )

    @patch("studio.services." "concept_planner.requests.post")
    def test_fake_copy_label_causes_fallback(
        self,
        request_post,
    ):
        payload = self.gemini_concepts(1)

        payload["concepts"][0]["body_copy_primary"] = "Template concept for Persona 1"

        request_post.return_value = self.response_with_payload(payload)

        response = self.client.post(
            "/api/studio/concept-plans/",
            {
                "project_id": str(self.project.id),
                "total_ads_requested": 1,
                "profile_ids": [str(self.profiles[0].id)],
                "template_ids": [str(self.templates[0].id)],
            },
            format="json",
            **self.headers,
        )

        concept = response.data["concepts"][0]

        self.assertEqual(
            concept["source"],
            "fallback",
        )

        self.assertEqual(
            concept["body_copy_primary"],
            "",
        )

    @patch("studio.services." "concept_planner.requests.post")
    def test_plan_is_persisted(
        self,
        request_post,
    ):
        request_post.return_value = self.response_with_payload(self.gemini_concepts(2))

        response = self.client.post(
            "/api/studio/concept-plans/",
            {
                "project_id": str(self.project.id),
                "total_ads_requested": 5,
                "profile_ids": [str(profile.id) for profile in self.profiles],
                "template_ids": [str(template.id) for template in self.templates],
            },
            format="json",
            **self.headers,
        )

        plan = ConceptPlan.objects.get(id=response.data["concept_plan_id"])

        self.assertEqual(
            plan.total_ads_requested,
            5,
        )

        self.assertEqual(
            plan.project_id,
            self.project.id,
        )

        self.assertEqual(
            sum(concept["ads_count"] for concept in plan.plan_data["concepts"]),
            5,
        )

    def test_rejects_cross_workspace_profile(
        self,
    ):
        other = Workspace.objects.create(
            name="Other",
            slug="other-planner",
            workspace_type="individual",
            owner=self.user,
        )

        foreign_profile = BrandIntelligenceProfile.objects.create(
            workspace=other,
            persona="Foreign",
            pain_point="Foreign pain",
            angle="Foreign angle",
        )

        response = self.client.post(
            "/api/studio/concept-plans/",
            {
                "project_id": str(self.project.id),
                "total_ads_requested": 1,
                "profile_ids": [str(foreign_profile.id)],
                "template_ids": [str(self.templates[0].id)],
            },
            format="json",
            **self.headers,
        )

        self.assertEqual(
            response.status_code,
            400,
        )

    def test_rejects_project_from_another_workspace(
        self,
    ):
        other_workspace = Workspace.objects.create(
            name="Other workspace",
            slug="other-project-workspace",
            workspace_type="individual",
            owner=self.user,
        )

        foreign_project = AdProject.objects.create(
            workspace=other_workspace,
            created_by=self.user,
            name="Proyecto externo",
            status="draft",
        )

        response = self.client.post(
            "/api/studio/concept-plans/",
            {
                "project_id": str(foreign_project.id),
                "total_ads_requested": 1,
                "profile_ids": [str(self.profiles[0].id)],
                "template_ids": [str(self.templates[0].id)],
            },
            format="json",
            **self.headers,
        )

        self.assertEqual(
            response.status_code,
            404,
        )

    @patch("studio.services." "concept_planner.requests.post")
    def test_planner_prompt_uses_layout_constraints(
        self,
        request_post,
    ):
        request_post.return_value = self.response_with_payload(self.gemini_concepts(1))

        response = self.client.post(
            "/api/studio/concept-plans/",
            {
                "project_id": str(self.project.id),
                "total_ads_requested": 1,
                "profile_ids": [
                    str(self.profiles[0].id),
                ],
                "template_ids": [
                    str(self.templates[0].id),
                ],
            },
            format="json",
            **self.headers,
        )

        self.assertEqual(
            response.status_code,
            201,
            response.data,
        )

        request_kwargs = request_post.call_args.kwargs

        sent_payload = request_kwargs["json"]

        prompt = sent_payload["contents"][0]["parts"][0]["text"]

        self.assertIn(
            '"layout_constraints"',
            prompt,
        )

        self.assertNotIn(
            '"layout_schema"',
            prompt,
        )
