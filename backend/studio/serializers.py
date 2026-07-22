from django.db import transaction
from rest_framework import serializers

from .models import (
    AdProject,
    AdTemplate,
    BrandAsset,
    BrandKit,
    BrandRule,
    CreativeAngle,
    CreativeReference,
    CreativeRecipe,
    GeneratedAsset,
    GenerationJob,
    Product,
    ProjectInputAsset,
    ProjectReference,
    WorkspacePreference,
)
from .services.prompts import build_generation_prompt


class BrandRuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = BrandRule
        fields = "__all__"
        read_only_fields = ["brand_kit"]


class WorkspacePreferenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = WorkspacePreference
        fields = "__all__"
        read_only_fields = ["workspace", "learned_preferences", "updated_at"]


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
            "duration_seconds",
        ]

    def get_file_url(self, obj):
        request = self.context.get("request")
        if not obj.file:
            return ""
        return request.build_absolute_uri(obj.file.url) if request else obj.file.url


class BrandKitSerializer(serializers.ModelSerializer):
    rules = BrandRuleSerializer(read_only=True)

    class Meta:
        model = BrandKit
        fields = "__all__"
        read_only_fields = ["workspace"]


class ProductSerializer(serializers.ModelSerializer):
    main_image_url = serializers.SerializerMethodField()
    image_asset_urls = serializers.SerializerMethodField()
    main_image_name = serializers.CharField(
        source="main_image_asset.name", read_only=True
    )

    class Meta:
        model = Product
        fields = "__all__"
        read_only_fields = ["workspace"]

    def get_main_image_url(self, obj):
        if not obj.main_image_asset or not obj.main_image_asset.file:
            if obj.image:
                request = self.context.get("request")
                return request.build_absolute_uri(obj.image.url) if request else obj.image.url
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
                "url": request.build_absolute_uri(asset.file.url) if request else asset.file.url,
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
        if workspace_id and any(str(value.workspace_id) != workspace_id for value in values):
            raise serializers.ValidationError(
                "Una de las imágenes seleccionadas no pertenece al workspace activo."
            )
        return values


class CreativeRecipeSerializer(serializers.ModelSerializer):
    creative_angle_name = serializers.CharField(
        source="creative_angle.name", read_only=True
    )

    class Meta:
        model = CreativeRecipe
        fields = "__all__"
        read_only_fields = ["workspace", "created_by", "is_system_recipe"]


class CreativeAngleSerializer(serializers.ModelSerializer):
    class Meta:
        model = CreativeAngle
        fields = "__all__"


class AdTemplateSerializer(serializers.ModelSerializer):
    source_asset_name = serializers.CharField(
        source="source_asset.name", read_only=True
    )
    source_asset_url = serializers.SerializerMethodField()

    class Meta:
        model = AdTemplate
        fields = "__all__"
        read_only_fields = ["workspace", "created_by"]

    def get_source_asset_url(self, obj):
        if not obj.source_asset or not obj.source_asset.file:
            return ""
        request = self.context.get("request")
        url = obj.source_asset.file.url
        return request.build_absolute_uri(url) if request else url

    def validate_source_asset(self, value):
        request = self.context.get("request")
        workspace_id = request.headers.get("X-Workspace-ID") if request else None
        if workspace_id and str(value.workspace_id) != workspace_id:
            raise serializers.ValidationError(
                "El recurso seleccionado no pertenece al workspace activo."
            )
        return value


class GeneratedAssetSerializer(serializers.ModelSerializer):
    file_url = serializers.SerializerMethodField()
    project_name = serializers.CharField(source="project.name", read_only=True)

    class Meta:
        model = GeneratedAsset
        fields = "__all__"

    def get_file_url(self, obj):
        request = self.context.get("request")
        return request.build_absolute_uri(obj.file.url) if request and obj.file else None


class GenerationJobSerializer(serializers.ModelSerializer):
    assets = GeneratedAssetSerializer(many=True, read_only=True)
    project_name = serializers.CharField(source="project.name", read_only=True)

    class Meta:
        model = GenerationJob
        fields = "__all__"


class ProjectInputAssetSerializer(serializers.ModelSerializer):
    brand_asset_name = serializers.CharField(
        source="brand_asset.name", read_only=True
    )
    brand_asset_url = serializers.SerializerMethodField()
    brand_asset_category = serializers.CharField(
        source="brand_asset.category", read_only=True
    )

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
    reference_title = serializers.CharField(source="reference.title", read_only=True)
    reference_image_url = serializers.SerializerMethodField()
    reference_source = serializers.CharField(source="reference.source", read_only=True)

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


class AdProjectSerializer(serializers.ModelSerializer):
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
        if value and workspace and value.workspace_id and value.workspace_id != workspace.id:
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
        input_assets = validated_data.pop("input_assets", [])
        references = validated_data.pop("references", [])
        project = super().create(validated_data)
        ProjectInputAsset.objects.bulk_create(
            [
                ProjectInputAsset(ad_project=project, **asset_data)
                for asset_data in input_assets
            ]
        )
        ProjectReference.objects.bulk_create(
            [
                ProjectReference(ad_project=project, **reference_data)
                for reference_data in references
            ]
        )
        return project


class GenerateSerializer(serializers.Serializer):
    number_of_outputs = serializers.IntegerField(min_value=1, max_value=6, default=3)
    provider = serializers.ChoiceField(
        choices=["auto", "gemini", "fal"], default="auto"
    )
    model_code = serializers.CharField(required=False, allow_blank=True, default="")
