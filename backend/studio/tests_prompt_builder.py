from django.test import TestCase

from accounts.models import User, Workspace
from studio.models import (
    AdProject,
    AdTemplate,
    BrandAsset,
    BrandIntelligenceProfile,
    BrandKit,
    CreativeReference,
    GenerationJob,
    GenerationJobInputAsset,
    GenerationJobReference,
    Purpose,
)
from studio.services.generation_inputs import (
    ordered_generation_image_sources,
)
from studio.services.prompts import (
    build_generation_prompt,
    layout_requires_single_canvas,
)


class GenerationPromptBuilderTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="prompt-builder@example.com",
            password="StrongPass!2026",
            status="active",
        )

        self.workspace = Workspace.objects.create(
            name="Prompt Builder",
            slug="prompt-builder",
            workspace_type="individual",
            owner=self.user,
        )

        self.brand_kit = BrandKit.objects.create(
            workspace=self.workspace,
            brand_name="Ascend",
            brand_description="Plataforma creativa",
            default_call_to_action="Empieza ahora",
            tone_of_voice="Profesional y claro",
        )

        self.template = AdTemplate.objects.create(
            workspace=self.workspace,
            name="Lienzo editorial único",
            description=("Composición central premium"),
            format=("instagram_post_portrait"),
            layout_constraints={
                "canvas_mode": "single",
                "allow_split_screen": False,
                "allow_collage": False,
                "max_product_instances": 1,
            },
            visual_structure=(
                "Producto central con titular " "dominante y CTA subordinado"
            ),
            copy_structure=(
                "Titular breve en primer nivel, "
                "argumento en segundo nivel y CTA "
                "como cierre"
            ),
            prompt_guidance=(
                "Mantener una composición premium " "con amplio espacio negativo"
            ),
            do_rules=[
                "Mantener jerarquía clara",
                "Dar protagonismo al producto",
            ],
            dont_rules=[
                "No saturar el fondo",
                "No crear paneles adicionales",
            ],
            created_by=self.user,
        )

        self.project = AdProject.objects.create(
            workspace=self.workspace,
            created_by=self.user,
            template=self.template,
            name="Proyecto base",
            headline="Titular del proyecto",
            offer_text="Oferta del proyecto",
            call_to_action="CTA del proyecto",
            use_brand_kit=True,
        )

        self.profile = BrandIntelligenceProfile.objects.create(
            workspace=self.workspace,
            persona=("Dueño de una pequeña empresa"),
            pain_point=("Pierde demasiado tiempo " "creando campañas manualmente"),
            angle=("Recuperar tiempo mediante " "automatización creativa"),
            visual_direction=("Escena profesional limpia, " "ordenada y eficiente"),
            emotion="Alivio y control",
            copy_hook=("Recupera las horas que " "pierdes creando anuncios"),
        )

        self.job = GenerationJob.objects.create(
            project=self.project,
            requested_by=self.user,
            template=self.template,
            name="Job editable",
            headline="Aumenta tu impacto",
            offer_text="Crea campañas con mayor consistencia",
            call_to_action="Solicita una demostración",
            target_audience="Equipos de marketing",
            focus_tags=["consistencia", "velocidad"],
            use_brand_kit=True,
            provider="gemini",
            model_name="gemini-2.5-flash-image",
            prompt="",
            status="draft",
        )

        self.concept_job = GenerationJob.objects.create(
            project=self.project,
            requested_by=self.user,
            template=self.template,
            format_used=self.template,
            profile_used=self.profile,
            concept_index=1,
            name=("Proyecto base · " "Concepto 1 · Variante 1"),
            headline=("Recupera tu tiempo"),
            offer_text=("Automatiza la creación " "de tus campañas"),
            call_to_action=("Empieza ahora"),
            target_audience=(self.profile.persona),
            focus_tags=[
                "automatización",
                "productividad",
            ],
            use_brand_kit=True,
            body_copy_primary=(
                "Automatiza la creación "
                "de campañas y dedica tu "
                "tiempo al crecimiento."
            ),
            body_copy_variant_a=(
                "Produce más campañas " "sin aumentar el trabajo manual."
            ),
            hook_variant=("Recupera tu tiempo"),
            rationale=(
                "El concepto conecta la falta "
                "de tiempo con una sensación "
                "de control mediante automatización."
            ),
            provider="fal",
            model_name=("fal-ai/" "nano-banana-pro/edit"),
            prompt="",
            status="draft",
        )

        self.persona_purpose, _ = Purpose.objects.update_or_create(
            code="persona",
            defaults={"label": "Persona"},
        )

        self.pose_purpose, _ = Purpose.objects.update_or_create(
            code="pose",
            defaults={"label": "Pose"},
        )

        self.style_purpose, _ = Purpose.objects.update_or_create(
            code="style",
            defaults={"label": "Style"},
        )

    def test_single_canvas_layout_is_detected(self):
        self.assertTrue(
            layout_requires_single_canvas(
                {
                    "composition": {
                        "mode": "single_canvas",
                    }
                }
            )
        )

    def test_prompt_uses_job_snapshot_instead_of_project(self):
        prompt = build_generation_prompt(
            self.project,
            job=self.job,
        )

        self.assertIn(
            'TITULAR LITERAL OBLIGATORIO: "Aumenta tu impacto"',
            prompt,
        )

        self.assertIn(
            'CTA LITERAL OBLIGATORIO: "Solicita una demostración"',
            prompt,
        )

        self.assertNotIn(
            'TITULAR LITERAL OBLIGATORIO: "Titular del proyecto"',
            prompt,
        )

    def test_prompt_contains_single_canvas_lock(
        self,
    ):
        prompt = build_generation_prompt(
            self.project,
            job=self.job,
        )

        self.assertIn(
            "RESTRICCIONES ESTRUCTURALES DE LAYOUT",
            prompt,
        )

        self.assertIn(
            "usa un único lienzo",
            prompt,
        )

        self.assertIn(
            "PROHIBIDO: split-screen",
            prompt,
        )

        self.assertIn(
            "before/after",
            prompt,
        )

    def test_prompt_uses_default_brand_cta_when_job_cta_is_empty(self):
        self.job.call_to_action = ""
        self.job.save(update_fields=["call_to_action"])

        prompt = build_generation_prompt(
            self.project,
            job=self.job,
        )

        self.assertIn(
            'CTA LITERAL OBLIGATORIO: "Empieza ahora"',
            prompt,
        )

    def test_image_numbers_follow_provider_order(self):
        reference = CreativeReference.objects.create(
            workspace=self.workspace,
            title="Anuncio editorial",
            category="reference_ad",
            image="creative-references/editorial.png",
            created_by=self.user,
        )

        reference_relation = GenerationJobReference.objects.create(
            generation_job=self.job,
            reference=reference,
            input_role="reference_ad",
            weight=90,
        )
        reference_relation.purpose.add(self.style_purpose)

        product_asset = BrandAsset.objects.create(
            workspace=self.workspace,
            category="product",
            name="Producto principal",
            file="brand-assets/product.png",
            mime_type="image/png",
            uploaded_by=self.user,
        )

        GenerationJobInputAsset.objects.create(
            generation_job=self.job,
            brand_asset=product_asset,
            input_role="product_image",
            sort_order=1,
        )

        person_asset = BrandAsset.objects.create(
            workspace=self.workspace,
            category="persona",
            name="Personaje principal",
            file="brand-assets/persona.png",
            mime_type="image/png",
            uploaded_by=self.user,
        )

        character_relation = GenerationJobInputAsset.objects.create(
            generation_job=self.job,
            brand_asset=person_asset,
            input_role="character_reference",
            sort_order=2,
        )
        character_relation.purpose.add(
            self.persona_purpose,
            self.pose_purpose,
        )

        sources = ordered_generation_image_sources(self.job)

        self.assertEqual(
            [source.input_role for source in sources],
            [
                "reference_ad",
                "product_image",
                "character_reference",
            ],
        )

        prompt = build_generation_prompt(
            self.project,
            job=self.job,
        )

        self.assertIn(
            'Image 1: nombre="Anuncio editorial"',
            prompt,
        )
        self.assertIn(
            'Image 2: nombre="Producto principal"',
            prompt,
        )
        self.assertIn(
            'Image 3: nombre="Personaje principal"',
            prompt,
        )
        self.assertIn(
            "REGLA DURA DE PERSONA: Image 3",
            prompt,
        )

    def test_flash_image_prompt_does_not_reference_more_than_three_images(self):
        for index in range(5):
            asset = BrandAsset.objects.create(
                workspace=self.workspace,
                category="reference_ad",
                name=f"Referencia {index + 1}",
                file=f"brand-assets/reference-{index + 1}.png",
                mime_type="image/png",
                uploaded_by=self.user,
            )

            GenerationJobInputAsset.objects.create(
                generation_job=self.job,
                brand_asset=asset,
                input_role="reference_ad",
                sort_order=index,
            )

        prompt = build_generation_prompt(
            self.project,
            job=self.job,
        )

        self.assertIn("Image 3:", prompt)
        self.assertNotIn("Image 4:", prompt)

    def test_concept_prompt_uses_profile_strategy(
        self,
    ):
        prompt = build_generation_prompt(
            self.project,
            job=self.concept_job,
        )

        self.assertIn(
            "ESTRATEGIA DEL CONCEPTO",
            prompt,
        )

        self.assertIn(
            "Índice del concepto: 1",
            prompt,
        )

        self.assertIn(
            ("Persona objetivo: " "Dueño de una pequeña empresa"),
            prompt,
        )

        self.assertIn(
            (
                "Pain point principal: "
                "Pierde demasiado tiempo "
                "creando campañas manualmente"
            ),
            prompt,
        )

        self.assertIn(
            (
                "Ángulo persuasivo: "
                "Recuperar tiempo mediante "
                "automatización creativa"
            ),
            prompt,
        )

        self.assertIn(
            "Emoción objetivo: Alivio y control",
            prompt,
        )

        self.assertIn(
            (
                "Hook estratégico del perfil: "
                "Recupera las horas que "
                "pierdes creando anuncios"
            ),
            prompt,
        )

    def test_concept_prompt_contains_rationale(
        self,
    ):
        prompt = build_generation_prompt(
            self.project,
            job=self.concept_job,
        )

        self.assertIn(
            (
                "Rationale del concepto: "
                "El concepto conecta la falta "
                "de tiempo con una sensación "
                "de control mediante automatización."
            ),
            prompt,
        )

    def test_concept_prompt_uses_profile_visual_direction(
        self,
    ):
        prompt = build_generation_prompt(
            self.project,
            job=self.concept_job,
        )

        self.assertIn(
            "DIRECCIÓN VISUAL DEL CONCEPTO",
            prompt,
        )

        self.assertIn(
            ("Escena profesional limpia, " "ordenada y eficiente"),
            prompt,
        )

    def test_prompt_contains_enriched_template_rules(
        self,
    ):
        prompt = build_generation_prompt(
            self.project,
            job=self.concept_job,
        )

        self.assertIn(
            ("ESTRUCTURA CREATIVA " "DE LA PLANTILLA"),
            prompt,
        )

        self.assertIn(
            (
                "Estructura visual: "
                "Producto central con titular "
                "dominante y CTA subordinado"
            ),
            prompt,
        )

        self.assertIn(
            (
                "Estructura de copy: "
                "Titular breve en primer nivel, "
                "argumento en segundo nivel y CTA "
                "como cierre"
            ),
            prompt,
        )

        self.assertIn(
            (
                "Guía de generación: "
                "Mantener una composición premium "
                "con amplio espacio negativo"
            ),
            prompt,
        )

        self.assertIn(
            "Mantener jerarquía clara",
            prompt,
        )

        self.assertIn(
            "No saturar el fondo",
            prompt,
        )

    def test_concept_prompt_contains_structured_copy(
        self,
    ):
        prompt = build_generation_prompt(
            self.project,
            job=self.concept_job,
        )

        self.assertIn(
            "COPY DEL CONCEPTO",
            prompt,
        )

        self.assertIn(
            ("Hook seleccionado: " "Recupera tu tiempo"),
            prompt,
        )

        self.assertIn(
            (
                "Body copy principal: "
                "Automatiza la creación de campañas "
                "y dedica tu tiempo al crecimiento."
            ),
            prompt,
        )

        self.assertIn(
            (
                "Body copy variante A: "
                "Produce más campañas sin aumentar "
                "el trabajo manual."
            ),
            prompt,
        )

        self.assertIn(
            "CTA del concepto: Empieza ahora",
            prompt,
        )

    def test_concept_copy_remains_literal(
        self,
    ):
        prompt = build_generation_prompt(
            self.project,
            job=self.concept_job,
        )

        self.assertIn(
            ("TITULAR LITERAL OBLIGATORIO: " '"Recupera tu tiempo"'),
            prompt,
        )

        self.assertIn(
            (
                "TEXTO DE OFERTA O ARGUMENTO: "
                '"Automatiza la creación '
                'de tus campañas"'
            ),
            prompt,
        )

        self.assertIn(
            ("CTA LITERAL OBLIGATORIO: " '"Empieza ahora"'),
            prompt,
        )

    def test_manual_job_does_not_require_concept_profile(
        self,
    ):
        prompt = build_generation_prompt(
            self.project,
            job=self.job,
        )

        self.assertNotIn(
            "ESTRATEGIA DEL CONCEPTO",
            prompt,
        )

        self.assertNotIn(
            "DIRECCIÓN VISUAL DEL CONCEPTO",
            prompt,
        )

        self.assertNotIn(
            "COPY DEL CONCEPTO",
            prompt,
        )

        self.assertIn(
            ("TITULAR LITERAL OBLIGATORIO: " '"Aumenta tu impacto"'),
            prompt,
        )

    def test_manual_target_audience_is_used_without_profile(
        self,
    ):
        self.job.profile_used = None
        self.job.target_audience = "Dueños de pequeños negocios"

        self.job.save(
            update_fields=[
                "profile_used",
                "target_audience",
            ]
        )

        prompt = build_generation_prompt(
            self.project,
            job=self.job,
        )

        self.assertIn(
            ("Audiencia objetivo: " "Dueños de pequeños negocios"),
            prompt,
        )

    def test_profile_used_overrides_manual_target_audience(
        self,
    ):
        self.job.profile_used = self.profile

        self.job.target_audience = "ESTA AUDIENCIA NO DEBE USARSE"

        self.job.save(
            update_fields=[
                "profile_used",
                "target_audience",
            ]
        )

        prompt = build_generation_prompt(
            self.project,
            job=self.job,
        )

        self.assertIn(
            self.profile.persona,
            prompt,
        )

        self.assertNotIn(
            "ESTA AUDIENCIA NO DEBE USARSE",
            prompt,
        )
