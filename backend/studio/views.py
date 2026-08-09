import requests as http_requests

from django.conf import settings
from django.core.files.base import ContentFile
from django.db import IntegrityError, transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from accounts.models import Workspace
from integrations.models import AIProviderConnection
from .models import *
from .serializers import *
from .permissions import WorkspaceAccess
from .services.generation import (
    GenerationProviderError,
    GeminiGenerationProvider,
    MockGenerationProvider,
)
from .services.prompts import build_generation_prompt
from integrations.services.models import FAL_IMAGE_MODELS, GEMINI_IMAGE_MODELS
from .services.generation_queue import (
    create_generation_batch,
    update_generation_batch_status,
)
from .services.generation_dimensions import resolve_job_parameters
from .tasks import dispatch_generation_batch, process_generation_job

from .services.brand_intelligence import (
    BrandIntelligenceGenerationError,
    generate_brand_intelligence,
)
from .services.prompt_composer import (
    PromptComposerError,
    compose_prompt_with_gemini,
    detect_composed_prompt_quality_issues,
)
from .services.template_analysis import (
    TemplateAnalysisError,
    reanalyze_ad_template,
)
from .services.concept_planner import (
    ConceptPlannerError,
    ConceptPlannerValidationError,
    plan_concepts,
)
from .services.concept_expansion import (
    ConceptExpansionError,
    expand_plan_to_jobs,
)

ALLOWED_AI_MODELS = {
    "gemini": {
        code: {"provider_model": code, "label": label, "media_type": "image"}
        for code, label in GEMINI_IMAGE_MODELS.items()
    },
    "fal": {
        "nano-banana-pro-edit": {
            "provider_model": "fal-ai/nano-banana-pro/edit",
            "label": FAL_IMAGE_MODELS["nano-banana-pro-edit"],
            "media_type": "image",
        },
    },
}


class WorkspaceScopedMixin:
    permission_classes = [WorkspaceAccess]

    def workspace(self):
        wid = self.request.headers.get(
            "X-Workspace-ID"
        ) or self.request.query_params.get("workspace_id")
        if not wid:
            raise NotFound("Workspace requerido.")
        return get_object_or_404(Workspace, id=wid)


class BrandKitViewSet(WorkspaceScopedMixin, viewsets.ModelViewSet):
    serializer_class = BrandKitSerializer

    def get_queryset(self):
        return BrandKit.objects.filter(workspace=self.workspace()).order_by(
            "created_at"
        )

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["workspace"] = self.workspace()
        return context

    def perform_create(self, s):
        s.save(workspace=self.workspace())

    @action(detail=False, methods=["get"], url_path="google-fonts")
    def google_fonts(self, request):
        fallback = [
            "Inter",
            "Roboto",
            "Open Sans",
            "Lato",
            "Montserrat",
            "Poppins",
            "Raleway",
            "Nunito",
            "Playfair Display",
            "Merriweather",
            "DM Sans",
            "DM Serif Display",
            "Oswald",
            "Source Sans 3",
            "Libre Baskerville",
            "Work Sans",
            "Manrope",
            "Rubik",
            "Fira Sans",
            "Bebas Neue",
        ]
        if not settings.GOOGLE_FONTS_API_KEY:
            return Response(
                {
                    "items": fallback,
                    "catalog_complete": False,
                    "detail": "Configura GOOGLE_FONTS_API_KEY para cargar el catálogo completo.",
                }
            )
        try:
            response = http_requests.get(
                "https://www.googleapis.com/webfonts/v1/webfonts",
                params={"key": settings.GOOGLE_FONTS_API_KEY, "sort": "popularity"},
                timeout=8,
            )
            response.raise_for_status()
            return Response(
                {
                    "items": [
                        item["family"] for item in response.json().get("items", [])
                    ],
                    "catalog_complete": True,
                }
            )
        except http_requests.RequestException:
            return Response(
                {
                    "items": fallback,
                    "catalog_complete": False,
                    "detail": "No se pudo actualizar Google Fonts; se muestra el catálogo local.",
                }
            )


class BrandRuleViewSet(WorkspaceScopedMixin, viewsets.ModelViewSet):
    serializer_class = BrandRuleSerializer

    def get_queryset(self):
        return BrandRule.objects.filter(brand_kit__workspace=self.workspace()).order_by(
            "created_at"
        )

    def perform_create(self, s):
        kit = get_object_or_404(BrandKit, workspace=self.workspace())
        s.save(brand_kit=kit)


class BrandIntelligenceProfileViewSet(
    WorkspaceScopedMixin,
    viewsets.ModelViewSet,
):
    serializer_class = BrandIntelligenceProfileSerializer
    http_method_names = [
        "get",
        "post",
        "patch",
        "delete",
        "head",
        "options",
    ]

    def get_queryset(self):
        queryset = BrandIntelligenceProfile.objects.filter(workspace=self.workspace())

        is_active = self.request.query_params.get("is_active")

        if is_active is not None:
            normalized = is_active.lower()

            if normalized in {"true", "1", "yes"}:
                queryset = queryset.filter(is_active=True)
            elif normalized in {"false", "0", "no"}:
                queryset = queryset.filter(is_active=False)

        return queryset.order_by("-created_at")

    def perform_create(self, serializer):
        serializer.save(workspace=self.workspace())

    @action(
        detail=False,
        methods=["post"],
        url_path="generate",
    )
    def generate(self, request):
        input_serializer = BrandIntelligenceGenerateSerializer(data=request.data)

        input_serializer.is_valid(raise_exception=True)

        workspace = self.workspace()

        try:
            profiles = generate_brand_intelligence(
                workspace=workspace,
                research_notes=(input_serializer.validated_data["research_notes"]),
                number_of_profiles=(
                    input_serializer.validated_data["number_of_profiles"]
                ),
                replace_existing=(input_serializer.validated_data["replace_existing"]),
            )

        except BrandIntelligenceGenerationError as exc:
            return Response(
                {
                    "detail": str(exc),
                    "status": ("generation_failed"),
                },
                status=(status.HTTP_400_BAD_REQUEST),
            )

        return Response(
            {
                "count": len(profiles),
                "profiles": (
                    BrandIntelligenceProfileSerializer(
                        profiles,
                        many=True,
                        context={"request": request},
                    ).data
                ),
            },
            status=(status.HTTP_201_CREATED),
        )


class ConceptPlanViewSet(
    WorkspaceScopedMixin,
    viewsets.ReadOnlyModelViewSet,
):
    """
    Pieza C.

    GET:
        lista / detalle de planes.

    POST:
        crea el plan conceptual para revisión.

    Todavía no genera imágenes.
    """

    serializer_class = ConceptPlanSerializer

    def get_queryset(self):
        return (
            ConceptPlan.objects.filter(workspace=self.workspace())
            .select_related(
                "requested_by",
                "project",
            )
            .order_by("-created_at")
        )

    def create(
        self,
        request,
        *args,
        **kwargs,
    ):
        input_serializer = ConceptPlanCreateSerializer(data=request.data)

        input_serializer.is_valid(raise_exception=True)

        workspace = self.workspace()

        project = get_object_or_404(
            AdProject,
            id=(input_serializer.validated_data["project_id"]),
            workspace=workspace,
        )

        try:
            concept_plan = plan_concepts(
                workspace=workspace,
                project=project,
                requested_by=request.user,
                total_ads_requested=(
                    input_serializer.validated_data["total_ads_requested"]
                ),
                profile_ids=(input_serializer.validated_data["profile_ids"]),
                template_ids=(input_serializer.validated_data["template_ids"]),
            )

        except ConceptPlannerValidationError as exc:
            return Response(
                {
                    "detail": str(exc),
                    "status": ("invalid_plan_input"),
                },
                status=(status.HTTP_400_BAD_REQUEST),
            )

        except ConceptPlannerError as exc:
            return Response(
                {
                    "detail": str(exc),
                    "status": ("planning_failed"),
                },
                status=(status.HTTP_400_BAD_REQUEST),
            )

        data = concept_plan.plan_data or {}

        return Response(
            {
                "concept_plan_id": str(concept_plan.id),
                "status": (concept_plan.status),
                "total_ads_requested": (concept_plan.total_ads_requested),
                "concepts": (
                    data.get(
                        "concepts",
                        [],
                    )
                ),
                "summary": (
                    data.get(
                        "summary",
                        {},
                    )
                ),
            },
            status=(status.HTTP_201_CREATED),
        )

    @action(
        detail=True,
        methods=["post"],
        url_path="generate",
    )
    def generate(
        self,
        request,
        pk=None,
    ):
        concept_plan = self.get_object()

        try:
            batch = expand_plan_to_jobs(concept_plan)

        except ConceptExpansionError as exc:
            return Response(
                {
                    "detail": str(exc),
                    "status": ("expansion_failed"),
                },
                status=(status.HTTP_400_BAD_REQUEST),
            )

        batch = (
            GenerationBatch.objects.select_related(
                "project",
                "requested_by",
                "concept_plan",
            )
            .prefetch_related(
                "jobs__assets",
                "jobs__provider_connection",
                "jobs__profile_used",
                "jobs__format_used",
            )
            .get(id=batch.id)
        )

        return Response(
            {
                "concept_plan_id": str(concept_plan.id),
                "concept_plan_status": ("generated"),
                "batch": (
                    GenerationBatchSerializer(
                        batch,
                        context={
                            "request": request,
                        },
                    ).data
                ),
            },
            status=(status.HTTP_201_CREATED),
        )


class WorkspacePreferenceViewSet(WorkspaceScopedMixin, viewsets.ModelViewSet):
    serializer_class = WorkspacePreferenceSerializer

    def get_queryset(self):
        return WorkspacePreference.objects.filter(workspace=self.workspace())

    def perform_create(self, s):
        s.save(workspace=self.workspace())


class BrandAssetViewSet(WorkspaceScopedMixin, viewsets.ModelViewSet):
    serializer_class = BrandAssetSerializer

    def get_queryset(self):
        return BrandAsset.objects.filter(workspace=self.workspace()).order_by(
            "-created_at"
        )

    def perform_create(self, s):
        upload = self.request.FILES.get("file")
        values = {"workspace": self.workspace(), "uploaded_by": self.request.user}
        if upload:
            values.update(
                {"file_size": upload.size, "mime_type": upload.content_type or ""}
            )
            try:
                from PIL import Image

                image = Image.open(upload)
                values.update({"width": image.width, "height": image.height})
                upload.seek(0)
            except Exception:
                pass
        s.save(**values)


class CreativeReferenceViewSet(WorkspaceScopedMixin, viewsets.ModelViewSet):
    serializer_class = CreativeReferenceSerializer

    def get_queryset(self):
        return CreativeReference.objects.filter(workspace=self.workspace()).order_by(
            "-created_at"
        )

    def perform_create(self, s):
        s.save(workspace=self.workspace(), created_by=self.request.user)


class ProductViewSet(WorkspaceScopedMixin, viewsets.ModelViewSet):
    serializer_class = ProductSerializer

    def get_queryset(self):
        return (
            Product.objects.filter(workspace=self.workspace())
            .select_related("main_image_asset")
            .prefetch_related("image_assets")
            .order_by("-created_at")
        )

    def perform_create(self, s):
        s.save(workspace=self.workspace())


class CreativeAngleViewSet(WorkspaceScopedMixin, viewsets.ModelViewSet):
    serializer_class = CreativeAngleSerializer

    def get_queryset(self):
        self.workspace()
        return CreativeAngle.objects.all().order_by("name")


class RecipeViewSet(WorkspaceScopedMixin, viewsets.ModelViewSet):
    serializer_class = CreativeRecipeSerializer

    def get_queryset(self):
        return (
            CreativeRecipe.objects.filter(
                models.Q(workspace=self.workspace()) | models.Q(is_system_recipe=True)
            )
            .select_related("creative_angle")
            .order_by("-is_system_recipe", "name")
        )

    def perform_create(self, s):
        s.save(
            workspace=self.workspace(),
            created_by=self.request.user,
            is_system_recipe=False,
        )

    def perform_update(self, s):
        if s.instance.workspace_id != self.workspace().id:
            raise PermissionDenied("Las recetas del sistema no se pueden modificar.")
        s.save()

    def perform_destroy(self, instance):
        if instance.workspace_id != self.workspace().id:
            raise PermissionDenied("Las recetas del sistema no se pueden eliminar.")
        instance.delete()


class AdTemplateViewSet(WorkspaceScopedMixin, viewsets.ModelViewSet):
    serializer_class = AdTemplateSerializer

    def get_queryset(self):
        return (
            AdTemplate.objects.filter(workspace=self.workspace())
            .prefetch_related(
                "example_images__image",
            )
            .order_by("-created_at")
        )

    def perform_create(self, s):
        s.save(workspace=self.workspace(), created_by=self.request.user)

    @action(
        detail=True,
        methods=["post"],
        url_path="examples",
    )
    def add_example(
        self,
        request,
        pk=None,
    ):
        template = self.get_object()

        serializer = AdTemplateExampleImageSerializer(
            data=request.data,
            context={
                "request": request,
                "ad_template": template,
            },
        )

        serializer.is_valid(raise_exception=True)

        try:
            example = serializer.save(ad_template=template)

        except IntegrityError:
            return Response(
                {"detail": ("Esta referencia ya está " "asignada a la plantilla.")},
                status=(status.HTTP_409_CONFLICT),
            )

        return Response(
            AdTemplateExampleImageSerializer(
                example,
                context={"request": request},
            ).data,
            status=(status.HTTP_201_CREATED),
        )

    @action(
        detail=True,
        methods=["delete"],
        url_path=(r"examples/" r"(?P<example_id>[^/.]+)"),
    )
    def remove_example(
        self,
        request,
        pk=None,
        example_id=None,
    ):
        template = self.get_object()

        example = get_object_or_404(
            AdTemplateExampleImage,
            id=example_id,
            ad_template=template,
        )

        example.delete()

        return Response(status=(status.HTTP_204_NO_CONTENT))

    @action(
        detail=True,
        methods=["post"],
        url_path="reanalyze",
    )
    def reanalyze(
        self,
        request,
        pk=None,
    ):
        template = self.get_object()

        try:
            analysis = reanalyze_ad_template(template)

        except TemplateAnalysisError as exc:
            return Response(
                {
                    "detail": str(exc),
                    "status": ("analysis_failed"),
                },
                status=(status.HTTP_400_BAD_REQUEST),
            )

        template.refresh_from_db()

        return Response(
            {
                "status": "analyzed",
                "analysis": analysis,
                "template": (
                    AdTemplateSerializer(
                        template,
                        context={"request": request},
                    ).data
                ),
            },
            status=(status.HTTP_200_OK),
        )


class PurposeViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = PurposeSerializer
    queryset = Purpose.objects.all().order_by("code")


def refresh_generation_job(job):
    job.parameters = resolve_job_parameters(job)
    job.prompt = build_generation_prompt(
        job.project,
        job=job,
    )

    # El prompt compuesto deja de ser válido cuando cambia el brief,
    # los parámetros o las imágenes del job.
    job.composed_prompt = None

    job.save(
        update_fields=[
            "parameters",
            "prompt",
            "composed_prompt",
            "updated_at",
        ]
    )

    return job


class GenerationJobViewSet(WorkspaceScopedMixin, viewsets.ModelViewSet):
    serializer_class = GenerationJobSerializer
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_queryset(self):
        return (
            GenerationJob.objects.filter(project__workspace=self.workspace())
            .select_related(
                "project",
                "requested_by",
                "provider_connection",
                "product",
                "template",
                "recipe",
                "creative_angle",
                "profile_used",
                "format_used",
            )
            .prefetch_related(
                "assets",
                "input_assets__brand_asset",
                "input_assets__purpose",
                "references__reference",
                "references__purpose",
            )
            .order_by("-created_at")
        )

    def perform_update(self, serializer):
        job = self.get_object()
        if job.status != "draft":
            raise PermissionDenied("Solo se pueden editar jobs en borrador.")
        job = serializer.save()
        refresh_generation_job(job)

    def perform_destroy(self, instance):
        if instance.status != "draft":
            raise PermissionDenied("Solo se pueden eliminar jobs en borrador.")
        instance.delete()

    @action(detail=False, methods=["post"], url_path="discard-session")
    def discard_session(self, request):
        session_id = request.data.get("session_id")
        if not session_id:
            return Response({"detail": "session_id requerido."}, status=400)
        jobs = self.get_queryset().filter(
            session_id=session_id,
            status="draft",
            requested_by=request.user,
            batch__isnull=True,
        )
        removable = [
            job.id
            for job in jobs
            if not job.input_assets.exists() and not job.references.exists()
        ]
        deleted_jobs = GenerationJob.objects.filter(id__in=removable).delete()[0]
        deleted_batches = GenerationBatch.objects.filter(
            project__workspace=self.workspace(),
            session_id=session_id,
            status="draft",
            requested_by=request.user,
            jobs__isnull=True,
        ).delete()[0]
        return Response(
            {"deleted_jobs": deleted_jobs, "deleted_batches": deleted_batches}
        )

    @action(detail=True, methods=["post"])
    def duplicate(self, request, pk=None):
        source = self.get_object()
        if source.status != "draft":
            return Response(
                {"detail": "Solo se pueden duplicar jobs en borrador."}, status=400
            )
        with transaction.atomic():
            source.pk = None
            source.id = None
            source.name = f"{source.name} · copia" if source.name else ""
            source.batch = None
            source.status = "draft"
            source.provider_request_id = ""
            source.error_message = ""
            source.retry_count = 0
            source.queue_position = None
            source.started_at = None
            source.enqueued_at = None
            source.completed_at = None
            source.save()
            original = GenerationJob.objects.prefetch_related(
                "input_assets__purpose", "references__purpose"
            ).get(pk=pk)
            for item in original.input_assets.select_related("brand_asset").all():
                copy = GenerationJobInputAsset.objects.create(
                    generation_job=source,
                    brand_asset=item.brand_asset,
                    input_role=item.input_role,
                    sort_order=item.sort_order,
                )
                copy.purpose.set(item.purpose.all())
            for item in original.references.select_related("reference").all():
                copy = GenerationJobReference.objects.create(
                    generation_job=source,
                    reference=item.reference,
                    input_role=item.input_role,
                    weight=item.weight,
                )
                copy.purpose.set(item.purpose.all())
            refresh_generation_job(source)
        return Response(
            GenerationJobSerializer(source, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"])
    def retry(self, request, pk=None):
        with transaction.atomic():
            job = get_object_or_404(self.get_queryset().select_for_update(), pk=pk)
            if job.status != "failed":
                return Response(
                    {"detail": "Solo se pueden reintentar jobs fallidos."}, status=400
                )
            if job.retry_count >= settings.GENERATION_JOB_MAX_RETRIES:
                return Response(
                    {"detail": "Este job alcanzó el máximo de reintentos."}, status=400
                )
            connection = AIProviderConnection.objects.filter(
                id=job.provider_connection_id, status=AIProviderConnection.Status.ACTIVE
            ).first()
            if not connection:
                return Response(
                    {"detail": "La conexión del proveedor ya no está activa."},
                    status=400,
                )
            job.status = "queued"
            job.error_message = ""
            job.started_at = None
            job.completed_at = None
            job.cancel_requested = False
            job.save(
                update_fields=[
                    "status",
                    "error_message",
                    "started_at",
                    "completed_at",
                    "cancel_requested",
                    "updated_at",
                ]
            )
            if job.batch_id:
                update_generation_batch_status(job.batch_id)
            transaction.on_commit(
                lambda: process_generation_job.apply_async(
                    args=[str(job.id)], queue="generation"
                )
            )
        return Response(GenerationJobSerializer(job, context={"request": request}).data)

    @action(detail=True, methods=["post"], url_path="input-assets")
    def add_input_asset(self, request, pk=None):
        job = self.get_object()
        if job.status != "draft":
            return Response(
                {"detail": "Solo se pueden editar recursos de jobs en borrador."},
                status=400,
            )
        role = request.data.get("input_role", "reference_ad")
        data = request.data.copy()
        if not data.get("purpose"):
            (
                data.setlist("purpose", default_purposes(role))
                if hasattr(data, "setlist")
                else data.update({"purpose": default_purposes(role)})
            )
        serializer = GenerationJobInputAssetSerializer(
            data=data, context={"request": request, "job": job}
        )
        serializer.is_valid(raise_exception=True)
        if role not in MULTI_INPUT_ROLES:
            GenerationJobInputAsset.objects.filter(
                generation_job=job, input_role=role
            ).delete()
            GenerationJobReference.objects.filter(
                generation_job=job, input_role=role
            ).delete()
        item = serializer.save(generation_job=job)
        refresh_generation_job(job)
        return Response(
            GenerationJobInputAssetSerializer(item, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

    @action(
        detail=True,
        methods=["delete"],
        url_path=r"input-assets/(?P<input_asset_id>[^/.]+)",
    )
    def remove_input_asset(self, request, pk=None, input_asset_id=None):
        job = self.get_object()
        if job.status != "draft":
            return Response(
                {"detail": "Solo se pueden editar recursos de jobs en borrador."},
                status=400,
            )
        item = get_object_or_404(
            GenerationJobInputAsset, id=input_asset_id, generation_job=job
        )
        item.delete()
        refresh_generation_job(job)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"], url_path="references")
    def add_reference(self, request, pk=None):
        job = self.get_object()
        if job.status != "draft":
            return Response(
                {"detail": "Solo se pueden editar recursos de jobs en borrador."},
                status=400,
            )
        role = request.data.get("input_role", "reference_ad")
        data = request.data.copy()
        if not data.get("purpose"):
            (
                data.setlist("purpose", default_purposes(role))
                if hasattr(data, "setlist")
                else data.update({"purpose": default_purposes(role)})
            )
        serializer = GenerationJobReferenceSerializer(
            data=data, context={"request": request, "job": job}
        )
        serializer.is_valid(raise_exception=True)
        if role not in MULTI_INPUT_ROLES:
            GenerationJobInputAsset.objects.filter(
                generation_job=job, input_role=role
            ).delete()
            GenerationJobReference.objects.filter(
                generation_job=job, input_role=role
            ).delete()
        item = serializer.save(generation_job=job)
        refresh_generation_job(job)
        return Response(
            GenerationJobReferenceSerializer(item, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

    @action(
        detail=True, methods=["delete"], url_path=r"references/(?P<reference_id>[^/.]+)"
    )
    def remove_reference(self, request, pk=None, reference_id=None):
        job = self.get_object()
        if job.status != "draft":
            return Response(
                {"detail": "Solo se pueden editar recursos de jobs en borrador."},
                status=400,
            )
        item = get_object_or_404(
            GenerationJobReference, id=reference_id, generation_job=job
        )
        item.delete()
        refresh_generation_job(job)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(
        detail=True,
        methods=["post"],
        url_path="compose-prompt",
    )
    def compose_prompt(self, request, pk=None):
        job = self.get_object()

        if job.status != "draft":
            return Response(
                {
                    "detail": (
                        "Solo se puede componer el prompt de " "un job en borrador."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Vuelve a construir el brief para evitar componer
        # sobre datos desactualizados.
        refresh_generation_job(job)
        job.refresh_from_db()

        try:
            composed_prompt = compose_prompt_with_gemini(job)
        except PromptComposerError as exc:
            return Response(
                {
                    "detail": str(exc),
                    "status": "composition_failed",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        quality = detect_composed_prompt_quality_issues(
            job,
            composed_prompt,
        )

        return Response(
            {
                "job_id": str(job.id),
                "status": "composed",
                "model": getattr(
                    settings,
                    "GEMINI_PROMPT_COMPOSER_MODEL",
                    "gemini-2.5-pro",
                ),
                "composed_prompt": composed_prompt,
                "quality": {
                    "is_valid": quality.is_valid,
                    "issues": list(quality.issues),
                },
            },
            status=status.HTTP_200_OK,
        )


class GenerationBatchViewSet(WorkspaceScopedMixin, viewsets.ReadOnlyModelViewSet):
    serializer_class = GenerationBatchSerializer

    def get_queryset(self):
        qs = (
            GenerationBatch.objects.filter(project__workspace=self.workspace())
            .select_related("project", "requested_by")
            .prefetch_related("jobs__assets", "jobs__provider_connection")
        )
        if self.request.query_params.get("project"):
            qs = qs.filter(project_id=self.request.query_params["project"])
        if self.request.query_params.get("status"):
            qs = qs.filter(status=self.request.query_params["status"])
        return qs

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        batch = self.get_object()
        with transaction.atomic():
            queued = list(batch.jobs.select_for_update().filter(status="queued"))
            now = timezone.now()
            for job in queued:
                job.status = "cancelled"
                job.cancel_requested = True
                job.completed_at = now
                job.save(
                    update_fields=[
                        "status",
                        "cancel_requested",
                        "completed_at",
                        "updated_at",
                    ]
                )
            batch.jobs.filter(status="processing").update(cancel_requested=True)
        update_generation_batch_status(batch.id)
        return Response(self.get_serializer(self.get_queryset().get(id=batch.id)).data)

    @action(
        detail=True,
        methods=["post"],
        url_path="dispatch",
    )
    def dispatch_batch(self, request, pk=None):
        batch = self.get_object()

        if batch.status != "draft":
            return Response(
                {"detail": ("Solo se pueden despachar batches " "en borrador.")},
                status=status.HTTP_400_BAD_REQUEST,
            )

        now = timezone.now()

        with transaction.atomic():
            batch = (
                GenerationBatch.objects.select_for_update()
                .select_related("project")
                .get(id=batch.id)
            )

            if batch.status != "draft":
                return Response(
                    {"detail": ("Solo se pueden despachar batches " "en borrador.")},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            jobs = list(
                batch.jobs.select_for_update()
                .filter(status="draft")
                .order_by(
                    "queue_position",
                    "created_at",
                )
            )

            if not jobs:
                return Response(
                    {"detail": ("El batch no tiene jobs en borrador.")},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            batch.status = "queued"
            batch.started_at = now
            batch.total_jobs = len(jobs)

            batch.save(
                update_fields=[
                    "status",
                    "started_at",
                    "total_jobs",
                    "updated_at",
                ]
            )

            for job in jobs:
                job.status = "queued"
                job.enqueued_at = now

                job.save(
                    update_fields=[
                        "status",
                        "enqueued_at",
                        "updated_at",
                    ]
                )

            batch.project.status = "generating"
            batch.project.save(
                update_fields=[
                    "status",
                    "updated_at",
                ]
            )

            transaction.on_commit(
                lambda: dispatch_generation_batch.delay(str(batch.id))
            )

        batch = self.get_queryset().get(id=batch.id)

        return Response(self.get_serializer(batch).data)


class GeneratedAssetViewSet(WorkspaceScopedMixin, viewsets.ReadOnlyModelViewSet):
    serializer_class = GeneratedAssetSerializer

    def get_queryset(self):
        return (
            GeneratedAsset.objects.filter(project__workspace=self.workspace())
            .select_related("project", "job")
            .order_by("-created_at")
        )

    @action(detail=True, methods=["post"], url_path="add-to-brand-assets")
    def add_to_brand_assets(self, request, pk=None):
        generated = self.get_object()
        category = request.data.get("category") or "reference_ad"
        valid = {value for value, _label in BrandAsset.CATEGORIES}
        if category not in valid:
            return Response({"detail": "Categoría inválida."}, status=400)
        if not generated.file:
            return Response(
                {"detail": "La imagen generada no tiene archivo."}, status=400
            )
        name = (request.data.get("name") or f"Generada · {generated.project.name}")[
            :255
        ]
        generated.file.open("rb")
        try:
            content = ContentFile(generated.file.read())
        finally:
            generated.file.close()
        asset = BrandAsset(
            workspace=generated.project.workspace,
            uploaded_by=request.user,
            category=category,
            name=name,
            mime_type=generated.mime_type,
            file_size=generated.file_size,
            width=generated.width,
            height=generated.height,
            metadata={
                "source": "generated_asset",
                "generated_asset_id": str(generated.id),
                "job_id": str(generated.job_id),
            },
        )
        extension = (
            generated.file.name.rsplit(".", 1)[-1]
            if "." in generated.file.name
            else "png"
        )
        asset.file.save(f"generated-{generated.id}.{extension}", content, save=True)
        return Response(
            BrandAssetSerializer(asset, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


class ProjectViewSet(WorkspaceScopedMixin, viewsets.ModelViewSet):
    serializer_class = AdProjectSerializer

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["workspace"] = self.workspace()
        return context

    def get_queryset(self):
        return (
            AdProject.objects.filter(workspace=self.workspace())
            .select_related("product", "template", "recipe", "creative_angle")
            .prefetch_related(
                "input_assets__brand_asset",
                "input_assets__purpose",
                "references__reference",
                "references__purpose",
                "jobs__assets",
            )
            .order_by("-created_at")
        )

    def perform_create(self, s):
        s.save(workspace=self.workspace(), created_by=self.request.user)

    @action(detail=True, methods=["post"], url_path="input-assets")
    def add_input_asset(self, request, pk=None):
        project = self.get_object()
        asset = get_object_or_404(
            BrandAsset, id=request.data.get("brand_asset"), workspace=project.workspace
        )
        data = request.data.copy()
        role = data.get("input_role", "reference_ad")
        if not data.get("purpose"):
            (
                data.setlist("purpose", default_purposes(role))
                if hasattr(data, "setlist")
                else data.update({"purpose": default_purposes(role)})
            )
        serializer = ProjectInputAssetSerializer(
            data=data, context={"request": request, "project": project}
        )
        serializer.is_valid(raise_exception=True)
        try:
            if role not in MULTI_INPUT_ROLES:
                ProjectInputAsset.objects.filter(
                    ad_project=project, input_role=role
                ).delete()
                ProjectReference.objects.filter(
                    ad_project=project, input_role=role
                ).delete()
            input_asset = serializer.save(ad_project=project, brand_asset=asset)
        except IntegrityError:
            return Response(
                {"detail": "Este recurso ya está asignado con el mismo rol."},
                status=status.HTTP_409_CONFLICT,
            )
        return Response(
            ProjectInputAssetSerializer(input_asset, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

    @action(
        detail=True,
        methods=["delete"],
        url_path=r"input-assets/(?P<input_asset_id>[^/.]+)",
    )
    def remove_input_asset(self, request, pk=None, input_asset_id=None):
        project = self.get_object()
        input_asset = get_object_or_404(
            ProjectInputAsset, id=input_asset_id, ad_project=project
        )
        input_asset.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"], url_path="references")
    def add_reference(self, request, pk=None):
        project = self.get_object()
        reference = get_object_or_404(
            CreativeReference,
            id=request.data.get("reference"),
            workspace=project.workspace,
        )
        data = request.data.copy()
        role = data.get("input_role", "reference_ad")
        if not data.get("purpose"):
            (
                data.setlist("purpose", default_purposes(role))
                if hasattr(data, "setlist")
                else data.update({"purpose": default_purposes(role)})
            )
        serializer = ProjectReferenceSerializer(
            data=data, context={"request": request, "project": project}
        )
        serializer.is_valid(raise_exception=True)
        if role not in MULTI_INPUT_ROLES:
            ProjectInputAsset.objects.filter(
                ad_project=project, input_role=role
            ).delete()
            ProjectReference.objects.filter(
                ad_project=project, input_role=role
            ).delete()
        project_reference = serializer.save(ad_project=project, reference=reference)
        return Response(
            ProjectReferenceSerializer(
                project_reference, context={"request": request}
            ).data,
            status=status.HTTP_201_CREATED,
        )

    @action(
        detail=True,
        methods=["delete"],
        url_path=r"references/(?P<project_reference_id>[^/.]+)",
    )
    def remove_reference(self, request, pk=None, project_reference_id=None):
        project = self.get_object()
        project_reference = get_object_or_404(
            ProjectReference, id=project_reference_id, ad_project=project
        )
        project_reference.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    def generation_batches(self, request, pk=None):
        project = self.get_object()
        serializer = GenerationBatchCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            batch = create_generation_batch(
                project=project,
                user=request.user,
                name=serializer.validated_data.get("name", ""),
                items=serializer.validated_data["jobs"],
                allowed_models=ALLOWED_AI_MODELS,
            )
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=400)
        batch = (
            GenerationBatch.objects.select_related("project", "requested_by")
            .prefetch_related("jobs__assets", "jobs__provider_connection")
            .get(id=batch.id)
        )
        return Response(
            GenerationBatchSerializer(batch, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"], url_path="generation-batches")
    def create_generation_batch_action(self, request, pk=None):
        return self.generation_batches(request, pk)

    @action(detail=True, methods=["post"], url_path="enqueue-draft-jobs")
    def enqueue_draft_jobs(self, request, pk=None):
        project = self.get_object()
        job_ids = request.data.get("job_ids") or []
        session_id = request.data.get("session_id")
        if not job_ids:
            return Response({"detail": "Selecciona al menos un job."}, status=400)
        with transaction.atomic():
            jobs = list(
                GenerationJob.objects.select_for_update()
                .filter(
                    id__in=job_ids,
                    project=project,
                    requested_by=request.user,
                    status="draft",
                    batch__isnull=True,
                )
                .order_by("created_at")
            )
            if len(jobs) != len(set(map(str, job_ids))):
                return Response(
                    {"detail": "Uno o más jobs no están disponibles como borrador."},
                    status=400,
                )
            batch = GenerationBatch.objects.create(
                project=project,
                requested_by=request.user,
                name=request.data.get("name", ""),
                status="draft",
                session_id=session_id or None,
                total_jobs=len(jobs),
                metadata={"schema_version": 2},
            )
            for position, job in enumerate(jobs, 1):
                job.batch = batch
                job.queue_position = position

                # Recalcula la configuración técnica definitiva.
                job.parameters = resolve_job_parameters(job)

                # ETAPA 1
                # Reconstruimos el brief usando el snapshot actual del job.
                job.prompt = build_generation_prompt(
                    project,
                    job=job,
                )

                # Cualquier composed_prompt existente fue generado a partir
                # de una versión anterior del brief y debe invalidarse.
                job.composed_prompt = None

                # También limpiamos datos residuales de una ejecución previa.
                job.provider_request_id = ""
                job.error_message = ""

                job.save(
                    update_fields=[
                        "batch",
                        "queue_position",
                        "parameters",
                        "prompt",
                        "composed_prompt",
                        "provider_request_id",
                        "error_message",
                        "updated_at",
                    ]
                )
        batch = (
            GenerationBatch.objects.select_related("project", "requested_by")
            .prefetch_related("jobs__assets", "jobs__provider_connection")
            .get(id=batch.id)
        )
        return Response(
            GenerationBatchSerializer(batch, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"], url_path="prepare-generation-job")
    def prepare_generation_job(self, request, pk=None):
        project = self.get_object()
        provider = request.data.get("provider", "auto")
        session_id = request.data.get("session_id")
        connection = AIProviderConnection.objects.filter(
            workspace=project.workspace, status=AIProviderConnection.Status.ACTIVE
        )
        connection = (
            connection.filter(is_default=True).first()
            if provider == "auto"
            else connection.filter(provider=provider).first()
        )
        connection = (
            connection
            or AIProviderConnection.objects.filter(
                workspace=project.workspace, status=AIProviderConnection.Status.ACTIVE
            ).first()
        )
        if not connection:
            return Response(
                {"detail": "Conecta Gemini o fal.ai antes de preparar un job."},
                status=400,
            )
        models = ALLOWED_AI_MODELS.get(connection.provider, {})
        model_code = request.data.get("model_code") or next(iter(models), "")
        if model_code not in models:
            return Response(
                {"detail": "Modelo no permitido para este proveedor."}, status=400
            )
        with transaction.atomic():
            job = GenerationJob.objects.create(
                project=project,
                requested_by=request.user,
                session_id=session_id or None,
                provider_connection=connection,
                product=project.product,
                template=project.template,
                recipe=project.recipe,
                creative_angle=project.creative_angle,
                name=project.name,
                message_type=project.message_type,
                campaign_theme=project.campaign_theme,
                headline=project.headline,
                offer_text=project.offer_text,
                call_to_action=project.call_to_action,
                target_audience="",
                focus_tags=project.focus_tags,
                use_brand_kit=project.use_brand_kit,
                provider=connection.provider,
                model_name=models[model_code]["provider_model"],
                prompt="",
                parameters={
                    "schema_version": 2,
                    "model_code": model_code,
                    "resolution": "1K",
                    "quality_mode": "standard",
                    "output_format": "png",
                },
                number_of_outputs=1,
                status="draft",
                priority=5,
            )
            for source in project.input_assets.prefetch_related(
                "purpose"
            ).select_related("brand_asset"):
                snapshot = GenerationJobInputAsset.objects.create(
                    generation_job=job,
                    brand_asset=source.brand_asset,
                    input_role=source.input_role,
                    sort_order=source.sort_order,
                )
                snapshot.purpose.set(source.purpose.all())
            for source in project.references.prefetch_related("purpose").select_related(
                "reference"
            ):
                snapshot = GenerationJobReference.objects.create(
                    generation_job=job,
                    reference=source.reference,
                    input_role=source.input_role,
                    weight=source.weight,
                )
                snapshot.purpose.set(source.purpose.all())
            refresh_generation_job(job)
        return Response(
            GenerationJobSerializer(job, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"])
    def generate(self, request, pk=None):
        project = self.get_object()
        serializer = GenerateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payload = {
            "name": "Generación rápida",
            "jobs": [
                {
                    "provider": serializer.validated_data["provider"],
                    "model_code": serializer.validated_data.get("model_code", ""),
                    "number_of_outputs": serializer.validated_data["number_of_outputs"],
                    "format": "portrait",
                    "resolution": "1K",
                    "quality_mode": "standard",
                    "output_format": "png",
                    "priority": 5,
                    "parameters": {},
                }
            ],
        }
        batch_serializer = GenerationBatchCreateSerializer(data=payload)
        batch_serializer.is_valid(raise_exception=True)
        try:
            batch = create_generation_batch(
                project=project,
                user=request.user,
                name=payload["name"],
                items=batch_serializer.validated_data["jobs"],
                allowed_models=ALLOWED_AI_MODELS,
            )
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=400)
        batch = GenerationBatch.objects.prefetch_related("jobs__assets").get(
            id=batch.id
        )
        return Response(
            GenerationBatchSerializer(batch, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )
