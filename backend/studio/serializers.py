from django.db import transaction
from rest_framework import serializers

from .models import (
    AdProject,
    AdTemplate,
    BrandAsset,
    BrandIntelligenceProfile,
    BrandKit,
    BrandRule,
    CreativeAngle,
    CreativeReference,
    CreativeRecipe,
    FORMAT_CHOICES,
    GeneratedAsset,
    GenerationJobInputAsset,
    GenerationJobReference,
    GenerationBatch,
    GenerationJob,
    Purpose,
    Product,
    ProjectInputAsset,
    ProjectReference,
    WorkspacePreference,
    AdTemplateExampleImage,
    ConceptPlan,
)
from .services.prompts import build_generation_prompt
from .services.resource_validation import (
    CREATIVE_REFERENCE_ONLY_BLOCKED_ROLES,
    ROLE_CATEGORY,
    allowed_purpose_codes,
    validate_brand_asset_for_generation,
    validate_reference_for_generation,
)

DEFAULT_PURPOSE_BY_ROLE = {
    "background": ["background"],
    "lifestyle_reference": ["lifestyle"],
    "packaging": ["packaging"],
    "icon": ["icon"],
    "logo": ["logo"],
    "template": ["template"],
}

MULTI_INPUT_ROLES = {"product_image", "character_reference", "reference_ad"}
BRAND_ASSET_ONLY_ROLES = {"product_image", "icon", "logo"}


def default_purposes(role):
    return list(DEFAULT_PURPOSE_BY_ROLE.get(role, []))


class BrandRuleSerializer(serializers.ModelSerializer):
    logo_position_preferences = serializers.JSONField(required=False, write_only=True)

    class Meta:
        model = BrandRule
        fields = "__all__"
        read_only_fields = ["brand_kit"]

    def create(self, validated_data):
        validated_data.pop("logo_position_preferences", None)
        return super().create(validated_data)

    def update(self, instance, validated_data):
        validated_data.pop("logo_position_preferences", None)
        return super().update(instance, validated_data)


class WorkspacePreferenceSerializer(serializers.ModelSerializer):
    preferred_styles = serializers.JSONField(required=False, write_only=True)
    preferred_backgrounds = serializers.JSONField(required=False, write_only=True)
    preferred_compositions = serializers.JSONField(required=False, write_only=True)
    preferred_text_density = serializers.CharField(
        required=False, allow_blank=True, write_only=True
    )
    preferred_product_scale = serializers.CharField(
        required=False, allow_blank=True, write_only=True
    )

    class Meta:
        model = WorkspacePreference
        fields = "__all__"
        read_only_fields = ["workspace", "learned_preferences", "updated_at"]

    def _drop_legacy(self, validated_data):
        for field in (
            "preferred_styles",
            "preferred_backgrounds",
            "preferred_compositions",
            "preferred_text_density",
            "preferred_product_scale",
        ):
            validated_data.pop(field, None)

    def create(self, validated_data):
        self._drop_legacy(validated_data)
        return super().create(validated_data)

    def update(self, instance, validated_data):
        self._drop_legacy(validated_data)
        return super().update(instance, validated_data)


class BrandAssetSerializer(serializers.ModelSerializer):
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = BrandAsset
        fields = "__all__"
        read_only_fields = [
            "workspace",
            "uploaded_by",
            "file_size",
            "mime_type",
            "width",
            "height",
        ]

    def get_file_url(self, obj):
        request = self.context.get("request")
        if not obj.file:
            return ""
        return request.build_absolute_uri(obj.file.url) if request else obj.file.url


class BrandKitSerializer(serializers.ModelSerializer):
    rules = BrandRuleSerializer(read_only=True)
    logo_url_value = serializers.SerializerMethodField()
    logo_dark_url_value = serializers.SerializerMethodField()
    logo_light_url_value = serializers.SerializerMethodField()

    class Meta:
        model = BrandKit
        fields = "__all__"
        read_only_fields = ["workspace"]

    def _asset_url(self, asset):
        if not asset or not asset.file:
            return ""
        request = self.context.get("request")
        return request.build_absolute_uri(asset.file.url) if request else asset.file.url

    def get_logo_url_value(self, obj):
        return self._asset_url(obj.logo_url)

    def get_logo_dark_url_value(self, obj):
        return self._asset_url(obj.logo_dark_url)

    def get_logo_light_url_value(self, obj):
        return self._asset_url(obj.logo_light_url)

    def validate(self, attrs):
        workspace = self.context.get("workspace")
        for field in ("logo_url", "logo_dark_url", "logo_light_url"):
            asset = attrs.get(field)
            if asset and asset.category != "logo":
                raise serializers.ValidationError(
                    {field: "El recurso debe tener category=logo."}
                )
            if asset and workspace and asset.workspace_id != workspace.id:
                raise serializers.ValidationError(
                    {field: "El logo no pertenece al workspace activo."}
                )
        return attrs


class BrandIntelligenceProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = BrandIntelligenceProfile
        fields = "__all__"
        read_only_fields = [
            "workspace",
            "created_at",
            "updated_at",
        ]


class BrandIntelligenceGenerateSerializer(serializers.Serializer):
    research_notes = serializers.CharField(
        required=True,
        allow_blank=False,
        trim_whitespace=True,
    )

    number_of_profiles = serializers.IntegerField(
        required=False,
        default=10,
        min_value=1,
        max_value=20,
    )

    replace_existing = serializers.BooleanField(
        required=False,
        default=False,
    )

    def validate_research_notes(self, value):
        value = value.strip()

        if len(value) < 30:
            raise serializers.ValidationError(
                "Las notas de investigación deben tener al menos 30 caracteres."
            )

        return value


class ConceptPlanSerializer(serializers.ModelSerializer):
    requested_by_email = serializers.EmailField(
        source="requested_by.email",
        read_only=True,
    )

    project_name = serializers.CharField(
        source="project.name",
        read_only=True,
        default="",
    )

    concept_count = serializers.SerializerMethodField()

    planned_ads = serializers.SerializerMethodField()

    planner_mode = serializers.SerializerMethodField()

    class Meta:
        model = ConceptPlan
        fields = "__all__"

        read_only_fields = [
            "workspace",
            "requested_by",
            "total_ads_requested",
            "status",
            "plan_data",
            "created_at",
            "updated_at",
        ]

    def get_concept_count(self, obj):
        return len(
            (obj.plan_data or {}).get(
                "concepts",
                [],
            )
        )

    def get_planned_ads(self, obj):
        return sum(
            int(concept.get("ads_count", 0))
            for concept in (obj.plan_data or {}).get(
                "concepts",
                [],
            )
        )

    def get_planner_mode(self, obj):
        return (obj.plan_data or {}).get("summary", {}).get("planner_mode", "")


class ConceptPlanCreateSerializer(serializers.Serializer):
    project_id = serializers.UUIDField(
        required=True,
    )

    total_ads_requested = serializers.IntegerField(
        min_value=1,
        max_value=50,
    )

    profile_ids = serializers.ListField(
        child=serializers.UUIDField(),
        allow_empty=False,
        max_length=20,
    )

    template_ids = serializers.ListField(
        child=serializers.UUIDField(),
        allow_empty=False,
        max_length=50,
    )

    def validate_profile_ids(self, value):
        unique = list(dict.fromkeys(value))

        if len(unique) != len(value):
            raise serializers.ValidationError(
                "profile_ids contiene valores duplicados."
            )

        return unique

    def validate_template_ids(self, value):
        unique = list(dict.fromkeys(value))

        if len(unique) != len(value):
            raise serializers.ValidationError(
                "template_ids contiene valores duplicados."
            )

        return unique


class ProductSerializer(serializers.ModelSerializer):
    main_image_url = serializers.SerializerMethodField()
    image_asset_urls = serializers.SerializerMethodField()
    image = serializers.ImageField(required=False, allow_null=True, write_only=True)
    main_image_name = serializers.CharField(
        source="main_image_asset.name", read_only=True
    )

    class Meta:
        model = Product
        fields = "__all__"
        read_only_fields = ["workspace"]

    def get_main_image_url(self, obj):
        if not obj.main_image_asset or not obj.main_image_asset.file:
            return ""
        request = self.context.get("request")
        url = obj.main_image_asset.file.url
        return request.build_absolute_uri(url) if request else url

    def get_image_asset_urls(self, obj):
        request = self.context.get("request")
        return [
            {
                "id": str(asset.id),
                "name": asset.name,
                "url": (
                    request.build_absolute_uri(asset.file.url)
                    if request
                    else asset.file.url
                ),
            }
            for asset in obj.image_assets.all()
            if asset.file
        ]

    def validate_main_image_asset(self, value):
        request = self.context.get("request")
        workspace_id = request.headers.get("X-Workspace-ID") if request else None
        if value and workspace_id and str(value.workspace_id) != workspace_id:
            raise serializers.ValidationError(
                "La imagen seleccionada no pertenece al workspace activo."
            )
        return value

    def validate_image_assets(self, values):
        request = self.context.get("request")
        workspace_id = request.headers.get("X-Workspace-ID") if request else None
        if workspace_id and any(
            str(value.workspace_id) != workspace_id for value in values
        ):
            raise serializers.ValidationError(
                "Una de las imágenes seleccionadas no pertenece al workspace activo."
            )
        return values

    def create(self, validated_data):
        validated_data.pop("image", None)
        return super().create(validated_data)

    def update(self, instance, validated_data):
        validated_data.pop("image", None)
        return super().update(instance, validated_data)


class CreativeRecipeSerializer(serializers.ModelSerializer):
    content_type = serializers.CharField(
        required=False, allow_blank=True, write_only=True
    )
    creative_angle_name = serializers.CharField(
        source="creative_angle.name", read_only=True
    )

    class Meta:
        model = CreativeRecipe
        fields = "__all__"
        read_only_fields = ["workspace", "created_by", "is_system_recipe"]

    def create(self, validated_data):
        validated_data.pop("content_type", None)
        return super().create(validated_data)

    def update(self, instance, validated_data):
        validated_data.pop("content_type", None)
        return super().update(instance, validated_data)


class CreativeAngleSerializer(serializers.ModelSerializer):
    class Meta:
        model = CreativeAngle
        fields = "__all__"


class AdTemplateExampleImageSerializer(serializers.ModelSerializer):
    image_title = serializers.CharField(
        source="image.title",
        read_only=True,
    )

    image_url = serializers.SerializerMethodField()

    image_source = serializers.CharField(
        source="image.source",
        read_only=True,
    )

    class Meta:
        model = AdTemplateExampleImage
        fields = "__all__"

        read_only_fields = [
            "ad_template",
            "gemini_vision_notes",
            "created_at",
            "updated_at",
        ]

    def get_image_url(self, obj):
        if not obj.image or not obj.image.image:
            return ""

        request = self.context.get("request")
        url = obj.image.image.url

        return request.build_absolute_uri(url) if request else url

    def validate_image(self, value):
        template = self.context.get("ad_template")

        if value.category != "template":
            raise serializers.ValidationError(
                "La referencia debe tener category=template."
            )

        if template and value.workspace_id != template.workspace_id:
            raise serializers.ValidationError(
                "La referencia no pertenece al " "workspace de la plantilla."
            )

        return value


class AdTemplateSerializer(serializers.ModelSerializer):
    content_type = serializers.CharField(
        required=False, allow_blank=True, write_only=True
    )
    format_specs = serializers.SerializerMethodField()
    example_images = AdTemplateExampleImageSerializer(
        many=True,
        read_only=True,
    )

    class Meta:
        model = AdTemplate
        fields = "__all__"
        read_only_fields = [
            "workspace",
            "created_by",
        ]

    def get_format_specs(self, obj):
        from .models import FORMAT_SPECS

        return FORMAT_SPECS.get(obj.format, {})

    def validate_source_asset(self, value):
        request = self.context.get("request")
        workspace_id = request.headers.get("X-Workspace-ID") if request else None
        if value and value.category != "template":
            raise serializers.ValidationError(
                "El recurso debe tener category=template."
            )
        if value and workspace_id and str(value.workspace_id) != workspace_id:
            raise serializers.ValidationError(
                "El recurso seleccionado no pertenece al workspace activo."
            )
        return value

    def validate_creative_reference(self, value):
        request = self.context.get("request")
        workspace_id = request.headers.get("X-Workspace-ID") if request else None
        if value and value.category != "template":
            raise serializers.ValidationError(
                "La referencia debe tener category=template."
            )
        if value and workspace_id and str(value.workspace_id) != workspace_id:
            raise serializers.ValidationError(
                "La referencia seleccionada no pertenece al workspace activo."
            )
        return value

    def validate(self, attrs):
        layout_constraints = attrs.get(
            "layout_constraints",
            getattr(
                self.instance,
                "layout_constraints",
                {},
            ),
        )

        if layout_constraints and not isinstance(
            layout_constraints,
            dict,
        ):
            raise serializers.ValidationError(
                {
                    "layout_constraints": (
                        "layout_constraints debe ser " "un objeto JSON."
                    )
                }
            )

        return attrs

    def create(self, validated_data):
        validated_data.pop("content_type", None)
        return super().create(validated_data)

    def update(self, instance, validated_data):
        validated_data.pop("content_type", None)
        return super().update(instance, validated_data)


class GeneratedAssetSerializer(serializers.ModelSerializer):
    file_url = serializers.SerializerMethodField()
    project_name = serializers.CharField(source="project.name", read_only=True)
    asset_type = serializers.SerializerMethodField()

    class Meta:
        model = GeneratedAsset
        fields = "__all__"

    def get_asset_type(self, obj):
        return "image"

    def get_file_url(self, obj):
        request = self.context.get("request")
        return (
            request.build_absolute_uri(obj.file.url) if request and obj.file else None
        )


class GenerationJobInputAssetSerializer(serializers.ModelSerializer):
    purpose = serializers.SlugRelatedField(
        slug_field="code", queryset=Purpose.objects.all(), many=True, required=False
    )
    brand_asset_name = serializers.CharField(source="brand_asset.name", read_only=True)
    brand_asset_url = serializers.SerializerMethodField()
    brand_asset_category = serializers.CharField(
        source="brand_asset.category", read_only=True
    )
    purpose_codes = serializers.SerializerMethodField()

    class Meta:
        model = GenerationJobInputAsset
        fields = "__all__"
        read_only_fields = ["generation_job"]

    def get_brand_asset_url(self, obj):
        if not obj.brand_asset or not obj.brand_asset.file:
            return ""
        request = self.context.get("request")
        url = obj.brand_asset.file.url
        return request.build_absolute_uri(url) if request else url

    def get_purpose_codes(self, obj):
        return list(obj.purpose.values_list("code", flat=True))

    def validate(self, attrs):
        job = self.context.get("job") or getattr(self.instance, "generation_job", None)
        asset = attrs.get("brand_asset") or getattr(self.instance, "brand_asset", None)
        role = attrs.get("input_role") or getattr(self.instance, "input_role", None)
        purposes = list(attrs.get("purpose", []))
        validate_brand_asset_for_generation(job, asset, role, purposes)
        return attrs


class GenerationJobReferenceSerializer(serializers.ModelSerializer):
    purpose = serializers.SlugRelatedField(
        slug_field="code", queryset=Purpose.objects.all(), many=True, required=False
    )
    reference_title = serializers.CharField(source="reference.title", read_only=True)
    reference_image_url = serializers.SerializerMethodField()
    reference_source = serializers.CharField(source="reference.source", read_only=True)
    purpose_codes = serializers.SerializerMethodField()

    class Meta:
        model = GenerationJobReference
        fields = "__all__"
        read_only_fields = ["generation_job"]

    def get_reference_image_url(self, obj):
        if not obj.reference.image:
            return ""
        request = self.context.get("request")
        url = obj.reference.image.url
        return request.build_absolute_uri(url) if request else url

    def get_purpose_codes(self, obj):
        return list(obj.purpose.values_list("code", flat=True))

    def validate(self, attrs):
        job = self.context.get("job") or getattr(self.instance, "generation_job", None)
        reference = attrs.get("reference") or getattr(self.instance, "reference", None)
        role = attrs.get("input_role") or getattr(self.instance, "input_role", None)
        purposes = list(attrs.get("purpose", []))
        validate_reference_for_generation(job, reference, role, purposes)
        return attrs


class GenerationJobSerializer(serializers.ModelSerializer):
    assets = GeneratedAssetSerializer(many=True, read_only=True)
    input_assets = GenerationJobInputAssetSerializer(many=True, read_only=True)
    references = GenerationJobReferenceSerializer(many=True, read_only=True)
    project_name = serializers.CharField(source="project.name", read_only=True)
    batch_name = serializers.CharField(source="batch.name", read_only=True, default="")
    profile_used_persona = serializers.CharField(
        source="profile_used.persona",
        read_only=True,
        default="",
    )

    format_used_name = serializers.CharField(
        source="format_used.name",
        read_only=True,
        default="",
    )

    class Meta:
        model = GenerationJob
        fields = "__all__"
        read_only_fields = [
            "requested_by",
            "provider_connection",
            "provider_request_id",
            "error_message",
            "retry_count",
            "started_at",
            "completed_at",
            "created_at",
            "updated_at",
            "composed_prompt",
        ]


class GenerationBatchSerializer(serializers.ModelSerializer):
    jobs = GenerationJobSerializer(many=True, read_only=True)
    project_name = serializers.CharField(source="project.name", read_only=True)
    requested_by = serializers.EmailField(source="requested_by.email", read_only=True)
    progress_percentage = serializers.SerializerMethodField()
    finished_jobs = serializers.SerializerMethodField()
    queued_jobs = serializers.SerializerMethodField()
    processing_jobs = serializers.SerializerMethodField()
    cancelled_jobs = serializers.SerializerMethodField()
    total_outputs = serializers.SerializerMethodField()
    completed_outputs = serializers.SerializerMethodField()

    class Meta:
        model = GenerationBatch
        fields = "__all__"

    def _jobs(self, obj):
        return list(obj.jobs.all())

    def get_finished_jobs(self, obj):
        return sum(
            job.status in ("completed", "failed", "cancelled")
            for job in self._jobs(obj)
        )

    def get_queued_jobs(self, obj):
        return sum(job.status == "queued" for job in self._jobs(obj))

    def get_processing_jobs(self, obj):
        return sum(job.status == "processing" for job in self._jobs(obj))

    def get_cancelled_jobs(self, obj):
        return sum(job.status == "cancelled" for job in self._jobs(obj))

    def get_total_outputs(self, obj):
        return sum(job.number_of_outputs for job in self._jobs(obj))

    def get_completed_outputs(self, obj):
        return sum(len(job.assets.all()) for job in self._jobs(obj))

    def get_progress_percentage(self, obj):
        return (
            round(self.get_finished_jobs(obj) * 100 / obj.total_jobs)
            if obj.total_jobs
            else 0
        )


class ProjectInputAssetSerializer(serializers.ModelSerializer):
    purpose = serializers.SlugRelatedField(
        slug_field="code", queryset=Purpose.objects.all(), many=True, required=False
    )
    brand_asset_name = serializers.CharField(source="brand_asset.name", read_only=True)
    brand_asset_url = serializers.SerializerMethodField()
    brand_asset_category = serializers.CharField(
        source="brand_asset.category", read_only=True
    )
    purpose_codes = serializers.SerializerMethodField()

    class Meta:
        model = ProjectInputAsset
        fields = "__all__"
        read_only_fields = ["ad_project"]

    def get_brand_asset_url(self, obj):
        if not obj.brand_asset or not obj.brand_asset.file:
            return ""
        request = self.context.get("request")
        url = obj.brand_asset.file.url
        return request.build_absolute_uri(url) if request else url

    def get_purpose_codes(self, obj):
        return list(obj.purpose.values_list("code", flat=True))

    def validate(self, attrs):
        project = self.context.get("project")
        asset = attrs.get("brand_asset")
        role = attrs.get("input_role")
        purposes = list(attrs.get("purpose", []))
        if project and asset and asset.workspace_id != project.workspace_id:
            raise serializers.ValidationError(
                "El recurso no pertenece al workspace activo."
            )
        expected_category = ROLE_CATEGORY.get(role)
        if expected_category and asset and asset.category != expected_category:
            raise serializers.ValidationError(
                {
                    "brand_asset": f"Para {role} se requiere category={expected_category}."
                }
            )
        if project and role == "product_image":
            product = project.product
            allowed_ids = set()
            if product:
                if product.main_image_asset_id:
                    allowed_ids.add(product.main_image_asset_id)
                allowed_ids |= set(product.image_assets.values_list("id", flat=True))
            if product and asset and asset.id not in allowed_ids:
                raise serializers.ValidationError(
                    {
                        "brand_asset": "La imagen de producto debe pertenecer al producto seleccionado."
                    }
                )
        if (
            project
            and not project.use_brand_kit
            and asset
            and asset.category not in {"reference_ad", "product"}
        ):
            raise serializers.ValidationError(
                {
                    "brand_asset": "Sin Brand Kit solo se permiten recursos reference_ad o imágenes de producto."
                }
            )
        allowed_purposes = allowed_purpose_codes(role, project)
        if allowed_purposes and purposes:
            codes = {purpose.code for purpose in purposes}
            invalid = codes - allowed_purposes
            if invalid:
                raise serializers.ValidationError(
                    {
                        "purpose": f"Propósitos no permitidos para {role}: {sorted(invalid)}."
                    }
                )
        return attrs


class CreativeReferenceSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = CreativeReference
        fields = "__all__"
        read_only_fields = ["workspace", "created_by", "created_at"]

    def get_image_url(self, obj):
        if not obj.image:
            return ""
        request = self.context.get("request")
        return request.build_absolute_uri(obj.image.url) if request else obj.image.url


class ProjectReferenceSerializer(serializers.ModelSerializer):
    purpose = serializers.SlugRelatedField(
        slug_field="code", queryset=Purpose.objects.all(), many=True, required=False
    )
    reference_title = serializers.CharField(source="reference.title", read_only=True)
    reference_image_url = serializers.SerializerMethodField()
    reference_source = serializers.CharField(source="reference.source", read_only=True)
    purpose_codes = serializers.SerializerMethodField()

    class Meta:
        model = ProjectReference
        fields = "__all__"
        read_only_fields = ["ad_project"]

    def get_reference_image_url(self, obj):
        if not obj.reference.image:
            return ""
        request = self.context.get("request")
        url = obj.reference.image.url
        return request.build_absolute_uri(url) if request else url

    def get_purpose_codes(self, obj):
        return list(obj.purpose.values_list("code", flat=True))

    def validate(self, attrs):
        project = self.context.get("project")
        reference = attrs.get("reference")
        role = attrs.get("input_role")
        purposes = list(attrs.get("purpose", []))
        if role in CREATIVE_REFERENCE_ONLY_BLOCKED_ROLES:
            raise serializers.ValidationError(
                {"input_role": f"{role} solo puede usar BrandAsset."}
            )
        expected_category = ROLE_CATEGORY.get(role)
        if project and reference and reference.workspace_id != project.workspace_id:
            raise serializers.ValidationError(
                "La referencia no pertenece al workspace activo."
            )
        if expected_category and reference and reference.category != expected_category:
            raise serializers.ValidationError(
                {"reference": f"Para {role} se requiere category={expected_category}."}
            )
        if (
            project
            and not project.use_brand_kit
            and reference
            and reference.category != "reference_ad"
        ):
            raise serializers.ValidationError(
                {
                    "reference": "Sin Brand Kit solo se permiten CreativeReference reference_ad."
                }
            )
        allowed_purposes = allowed_purpose_codes(role, project)
        if allowed_purposes and purposes:
            codes = {purpose.code for purpose in purposes}
            invalid = codes - allowed_purposes
            if invalid:
                raise serializers.ValidationError(
                    {
                        "purpose": f"Propósitos no permitidos para {role}: {sorted(invalid)}."
                    }
                )
        return attrs


class AdProjectSerializer(serializers.ModelSerializer):
    content_type = serializers.CharField(
        required=False, allow_blank=True, write_only=True
    )
    aspect_ratio = serializers.CharField(
        required=False, allow_blank=True, write_only=True
    )
    resolution = serializers.CharField(
        required=False, allow_blank=True, write_only=True
    )
    quality_mode = serializers.CharField(
        required=False, allow_blank=True, write_only=True
    )
    requested_variations = serializers.IntegerField(
        required=False, write_only=True, min_value=1
    )
    generation_prompt = serializers.SerializerMethodField()
    jobs = GenerationJobSerializer(many=True, read_only=True)
    input_assets = ProjectInputAssetSerializer(many=True, required=False)
    references = ProjectReferenceSerializer(many=True, required=False)
    product_name = serializers.CharField(source="product.name", read_only=True)
    template_name = serializers.CharField(source="template.name", read_only=True)
    recipe_name = serializers.CharField(source="recipe.name", read_only=True)
    creative_angle_name = serializers.CharField(
        source="creative_angle.name", read_only=True
    )

    class Meta:
        model = AdProject
        fields = "__all__"
        read_only_fields = ["workspace", "created_by", "status"]

    def get_generation_prompt(self, obj):
        return build_generation_prompt(obj)

    def validate_product(self, value):
        workspace = self.context.get("workspace")
        if value and workspace and value.workspace_id != workspace.id:
            raise serializers.ValidationError(
                "El producto no pertenece al workspace activo."
            )
        return value

    def validate_recipe(self, value):
        workspace = self.context.get("workspace")
        if (
            value
            and workspace
            and value.workspace_id
            and value.workspace_id != workspace.id
        ):
            raise serializers.ValidationError(
                "La receta no pertenece al workspace activo."
            )
        return value

    def validate_template(self, value):
        workspace = self.context.get("workspace")
        if value and workspace and value.workspace_id != workspace.id:
            raise serializers.ValidationError(
                "La plantilla no pertenece al workspace activo."
            )
        return value

    def validate_input_assets(self, values):
        workspace = self.context.get("workspace")
        if workspace:
            for value in values:
                if value["brand_asset"].workspace_id != workspace.id:
                    raise serializers.ValidationError(
                        "Uno de los recursos no pertenece al workspace activo."
                    )
        return values

    def validate_references(self, values):
        workspace = self.context.get("workspace")
        if workspace:
            for value in values:
                if value["reference"].workspace_id != workspace.id:
                    raise serializers.ValidationError(
                        "Una de las referencias no pertenece al workspace activo."
                    )
        return values

    @transaction.atomic
    def create(self, validated_data):
        for field in (
            "content_type",
            "aspect_ratio",
            "resolution",
            "quality_mode",
            "requested_variations",
        ):
            validated_data.pop(field, None)
        input_assets = validated_data.pop("input_assets", [])
        references = validated_data.pop("references", [])
        project = super().create(validated_data)
        for asset_data in input_assets:
            purposes = asset_data.pop("purpose", [])
            input_asset = ProjectInputAsset.objects.create(
                ad_project=project, **asset_data
            )
            input_asset.purpose.set(purposes)
        for reference_data in references:
            purposes = reference_data.pop("purpose", [])
            project_reference = ProjectReference.objects.create(
                ad_project=project, **reference_data
            )
            project_reference.purpose.set(purposes)
        return project

    def update(self, instance, validated_data):
        for field in (
            "content_type",
            "aspect_ratio",
            "resolution",
            "quality_mode",
            "requested_variations",
        ):
            validated_data.pop(field, None)
        return super().update(instance, validated_data)


class PurposeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Purpose
        fields = "__all__"


class GenerateSerializer(serializers.Serializer):
    number_of_outputs = serializers.IntegerField(min_value=1, max_value=6, default=3)
    provider = serializers.ChoiceField(
        choices=["auto", "gemini", "fal"], default="auto"
    )
    model_code = serializers.CharField(required=False, allow_blank=True, default="")


class GenerationQueueItemSerializer(serializers.Serializer):
    source_job_id = serializers.UUIDField(
        required=False,
        allow_null=True,
    )

    # Copia editable del AdProject
    product = serializers.PrimaryKeyRelatedField(
        queryset=Product.objects.all(),
        required=False,
        allow_null=True,
    )
    template = serializers.PrimaryKeyRelatedField(
        queryset=AdTemplate.objects.all(),
        required=False,
        allow_null=True,
    )
    recipe = serializers.PrimaryKeyRelatedField(
        queryset=CreativeRecipe.objects.all(),
        required=False,
        allow_null=True,
    )
    creative_angle = serializers.PrimaryKeyRelatedField(
        queryset=CreativeAngle.objects.all(),
        required=False,
        allow_null=True,
    )

    name = serializers.CharField(
        required=False,
        allow_blank=True,
        max_length=255,
    )
    message_type = serializers.CharField(
        required=False,
        allow_blank=True,
        max_length=100,
    )
    campaign_theme = serializers.CharField(
        required=False,
        allow_blank=True,
        max_length=255,
    )
    headline = serializers.CharField(
        required=False,
        allow_blank=True,
    )
    offer_text = serializers.CharField(
        required=False,
        allow_blank=True,
    )
    call_to_action = serializers.CharField(
        required=False,
        allow_blank=True,
        max_length=255,
    )
    target_audience = serializers.CharField(
        required=False,
        allow_blank=True,
    )
    focus_tags = serializers.ListField(
        child=serializers.CharField(),
        required=False,
        default=list,
    )
    use_brand_kit = serializers.BooleanField(
        required=False,
        default=True,
    )

    input_assets = serializers.ListField(
        child=serializers.DictField(),
        required=False,
        default=list,
    )
    references = serializers.ListField(
        child=serializers.DictField(),
        required=False,
        default=list,
    )

    # Configuración técnica
    provider = serializers.ChoiceField(
        choices=["auto", "gemini", "fal"],
        default="auto",
    )
    model_code = serializers.CharField(
        required=False,
        allow_blank=True,
        default="",
    )
    number_of_outputs = serializers.IntegerField(
        min_value=1,
        max_value=6,
        default=1,
    )
    format = serializers.ChoiceField(
        choices=[value for value, _ in FORMAT_CHOICES],
        default="portrait",
    )
    resolution = serializers.ChoiceField(
        choices=["1K", "2K", "4K"],
        default="1K",
    )
    quality_mode = serializers.ChoiceField(
        choices=["draft", "standard", "high", "premium"],
        default="standard",
    )
    output_format = serializers.ChoiceField(
        choices=["png", "jpeg", "webp"],
        default="png",
    )
    prompt_modifier = serializers.CharField(
        required=False,
        allow_blank=True,
        default="",
    )
    negative_prompt = serializers.CharField(
        required=False,
        allow_blank=True,
        default="",
    )
    seed = serializers.IntegerField(
        required=False,
        allow_null=True,
        min_value=0,
    )
    priority = serializers.IntegerField(
        min_value=1,
        max_value=10,
        default=5,
    )
    parameters = serializers.JSONField(
        required=False,
        default=dict,
    )


class GenerationBatchCreateSerializer(serializers.Serializer):
    name = serializers.CharField(required=False, allow_blank=True, max_length=255)
    jobs = GenerationQueueItemSerializer(
        many=True, allow_empty=False, min_length=1, max_length=25
    )

    def validate_jobs(self, jobs):
        total = sum(item["number_of_outputs"] for item in jobs)
        if total > 50:
            raise serializers.ValidationError(
                "La cola no puede solicitar más de 50 imágenes."
            )
        return jobs
