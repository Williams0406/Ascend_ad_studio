import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone

from accounts.models import Workspace


CONTENT_TYPES = [
    ("image", "Imagen"),
    ("video", "Video"),
    ("carousel", "Carrusel"),
]

PROJECT_CONTENT_TYPES = [
    (value, value)
    for value in (
        "flyer", "social_post", "story", "banner", "carousel",
        "short_video", "product_video",
    )
]

FORMAT_CHOICES = [
    ("post", "Post"),
    ("story", "Story"),
    ("banner", "Banner"),
    ("flyer", "Flyer"),
    ("reel", "Reel"),
]


class BrandKit(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.OneToOneField(
        Workspace, on_delete=models.CASCADE, related_name="brand_kit"
    )
    brand_name = models.CharField(max_length=200, blank=True)
    brand_description = models.TextField(blank=True)
    primary_color = models.CharField(max_length=20, blank=True)
    secondary_color = models.CharField(max_length=20, blank=True)
    accent_color = models.CharField(max_length=20, blank=True)
    font_primary = models.CharField(max_length=150, blank=True)
    font_secondary = models.CharField(max_length=150, blank=True)
    tone_of_voice = models.TextField(blank=True)
    default_call_to_action = models.CharField(max_length=255, blank=True)
    logo_url = models.URLField(blank=True)
    logo_dark_url = models.URLField(blank=True)
    logo_light_url = models.URLField(blank=True)
    created_at = models.DateTimeField(default=timezone.now, editable=False)
    updated_at = models.DateTimeField(auto_now=True)


class BrandRule(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    brand_kit = models.OneToOneField(
        BrandKit, on_delete=models.CASCADE, related_name="rules"
    )
    allowed_colors = models.JSONField(default=list, blank=True)
    forbidden_colors = models.JSONField(default=list, blank=True)
    allowed_fonts = models.JSONField(default=list, blank=True)
    required_elements = models.JSONField(default=list, blank=True)
    forbidden_elements = models.JSONField(default=list, blank=True)
    preferred_terms = models.JSONField(default=list, blank=True)
    forbidden_terms = models.JSONField(default=list, blank=True)
    logo_position_preferences = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)


class BrandAsset(models.Model):
    CATEGORIES = [
        (value, value)
        for value in (
            "product",
            "packaging",
            "lifestyle",
            "logo",
            "persona",
            "reference_ad",
            "template",
            "background",
            "icon",
            "other",
        )
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.ForeignKey(
        Workspace, on_delete=models.CASCADE, related_name="assets"
    )
    category = models.CharField(max_length=30, choices=CATEGORIES)
    name = models.CharField(max_length=255)
    file = models.FileField(upload_to="brand-assets/")
    thumbnail_url = models.URLField(blank=True)
    mime_type = models.CharField(max_length=100, blank=True)
    file_size = models.BigIntegerField(null=True, blank=True)
    width = models.IntegerField(null=True, blank=True)
    height = models.IntegerField(null=True, blank=True)
    duration_seconds = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True
    )
    is_favorite = models.BooleanField(default=False)
    metadata = models.JSONField(default=dict, blank=True)
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True
    )
    created_at = models.DateTimeField(auto_now_add=True)


class Product(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.ForeignKey(
        Workspace, on_delete=models.CASCADE, related_name="products"
    )
    name = models.CharField(max_length=255)
    short_description = models.CharField(max_length=500, blank=True)
    description = models.TextField(blank=True)
    brand_name = models.CharField(max_length=200, blank=True)
    product_category = models.CharField(max_length=150, blank=True, db_index=True)
    original_price = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True
    )
    sale_price = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True
    )
    discount_percentage = models.DecimalField(
        max_digits=5, decimal_places=2, null=True, blank=True
    )
    currency_code = models.CharField(max_length=3, default="PEN")
    primary_benefit = models.TextField(blank=True)
    target_customer = models.TextField(blank=True)
    product_url = models.URLField(blank=True)
    image = models.ImageField(upload_to="products/", blank=True)
    main_image_asset = models.ForeignKey(
        BrandAsset,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="main_products",
    )
    image_assets = models.ManyToManyField(
        BrandAsset,
        blank=True,
        related_name="products",
    )
    benefits = models.JSONField(default=list, blank=True)
    features = models.JSONField(default=list, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)


class CreativeAngle(models.Model):
    TYPES = [
        (value, value)
        for value in (
            "problem_solution",
            "benefit",
            "offer",
            "urgency",
            "scarcity",
            "comparison",
            "testimonial",
            "features",
            "lifestyle",
            "premium",
            "minimalist",
            "educational",
            "emotional",
        )
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code = models.CharField(max_length=50, choices=TYPES, unique=True)
    name = models.CharField(max_length=150)
    description = models.TextField(blank=True)
    example_headline = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)


class CreativeRecipe(models.Model):
    CONTENT_TYPES = CONTENT_TYPES

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.ForeignKey(
        Workspace,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="recipes",
    )
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    content_type = models.CharField(max_length=30, choices=CONTENT_TYPES)
    creative_angle = models.ForeignKey(
        CreativeAngle,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="recipes",
    )
    copy_rules = models.JSONField(default=dict, blank=True)
    visual_rules = models.JSONField(default=dict, blank=True)
    prompt_template = models.TextField()
    is_system_recipe = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_recipes",
    )
    created_at = models.DateTimeField(default=timezone.now, editable=False)
    updated_at = models.DateTimeField(auto_now=True)


class CreativeReference(models.Model):
    workspace = models.ForeignKey(
        Workspace,
        on_delete=models.CASCADE,
        related_name="creative_references",
    )
    title = models.CharField(max_length=255)
    image = models.ImageField(upload_to="creative-references/")
    source = models.CharField(max_length=100, blank=True)
    author = models.CharField(max_length=200, blank=True)
    url = models.URLField(blank=True)
    notes = models.TextField(blank=True)
    tags = models.JSONField(default=list)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)


class AdTemplate(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.ForeignKey(
        Workspace, on_delete=models.CASCADE, related_name="ad_templates"
    )
    name = models.CharField(max_length=255)
    source_asset = models.ForeignKey(
        BrandAsset, on_delete=models.PROTECT, related_name="templates"
    )
    description = models.TextField(blank=True)
    content_type = models.CharField(
        max_length=20, choices=CONTENT_TYPES, default="image"
    )
    format = models.CharField(
        max_length=20, choices=FORMAT_CHOICES, default="post"
    )
    layout_schema = models.JSONField(default=dict, blank=True)
    is_favorite = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)


class AdProject(models.Model):
    CONTENT_TYPES = PROJECT_CONTENT_TYPES
    STATUSES = [
        (value, value)
        for value in (
            "draft",
            "ready",
            "generating",
            "completed",
            "archived",
            "cancelled",
        )
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.ForeignKey(
        Workspace, on_delete=models.CASCADE, related_name="projects"
    )
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    product = models.ForeignKey(
        Product, on_delete=models.SET_NULL, null=True, blank=True
    )
    template = models.ForeignKey(
        AdTemplate,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="projects",
    )
    recipe = models.ForeignKey(
        CreativeRecipe, on_delete=models.SET_NULL, null=True, blank=True
    )
    creative_angle = models.ForeignKey(
        CreativeAngle,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="projects",
    )
    name = models.CharField(max_length=255)
    content_type = models.CharField(max_length=30, choices=CONTENT_TYPES)
    message_type = models.CharField(max_length=100, blank=True)
    campaign_theme = models.CharField(max_length=255, blank=True)
    headline = models.TextField(blank=True)
    offer_text = models.TextField(blank=True)
    call_to_action = models.CharField(max_length=255, blank=True)
    target_audience = models.TextField(blank=True)
    focus_tags = models.JSONField(default=list, blank=True)
    aspect_ratio = models.CharField(max_length=20, default="4:5")
    resolution = models.CharField(max_length=20, default="1K")
    quality_mode = models.CharField(max_length=30, default="standard")
    requested_variations = models.PositiveIntegerField(default=1)
    use_brand_kit = models.BooleanField(default=True)
    status = models.CharField(max_length=20, choices=STATUSES, default="draft")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)


class ProjectInputAsset(models.Model):
    INPUT_ROLES = [
        ("product_image", "Imagen del producto"),
        ("logo", "Logo"),
        ("background", "Fondo"),
        ("style_reference", "Referencia de estilo"),
        ("character_reference", "Referencia de personaje"),
        ("packaging", "Empaque"),
        ("other", "Otro"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    ad_project = models.ForeignKey(
        AdProject, on_delete=models.CASCADE, related_name="input_assets"
    )
    brand_asset = models.ForeignKey(
        BrandAsset, on_delete=models.CASCADE, related_name="project_inputs"
    )
    input_role = models.CharField(max_length=50, choices=INPUT_ROLES)
    sort_order = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["ad_project", "brand_asset", "input_role"],
                name="unique_project_input_asset_role",
            )
        ]


class ProjectReference(models.Model):
    PURPOSES = [
        ("style", "Style"),
        ("composition", "Composition"),
        ("lighting", "Lighting"),
        ("color", "Color"),
        ("typography", "Typography"),
        ("pose", "Pose"),
        ("mood", "Mood"),
    ]

    ad_project = models.ForeignKey(
        AdProject,
        related_name="references",
        on_delete=models.CASCADE,
    )
    reference = models.ForeignKey(
        CreativeReference,
        on_delete=models.CASCADE,
    )
    weight = models.PositiveSmallIntegerField(default=100)
    purpose = models.CharField(max_length=50, choices=PURPOSES)


class GenerationJob(models.Model):
    STATUSES = [
        (value, value)
        for value in ("queued", "processing", "completed", "failed", "cancelled")
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(
        AdProject, on_delete=models.CASCADE, related_name="jobs"
    )
    requested_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    provider_connection = models.ForeignKey(
        "integrations.AIProviderConnection",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="generation_jobs",
    )
    provider = models.CharField(max_length=100)
    model_name = models.CharField(max_length=200)
    generation_purpose = models.CharField(max_length=50, blank=True)
    prompt = models.TextField()
    negative_prompt = models.TextField(blank=True)
    parameters = models.JSONField(default=dict, blank=True)
    number_of_outputs = models.PositiveIntegerField(default=1)
    status = models.CharField(max_length=20, choices=STATUSES, default="queued")
    provider_request_id = models.CharField(max_length=255, blank=True)
    estimated_cost_usd = models.DecimalField(
        max_digits=12, decimal_places=6, null=True, blank=True
    )
    actual_cost_usd = models.DecimalField(
        max_digits=12, decimal_places=6, null=True, blank=True
    )
    error_message = models.TextField(blank=True)
    retry_count = models.PositiveIntegerField(default=0)
    credits_consumed = models.PositiveIntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)


class GeneratedAsset(models.Model):
    TYPES = [
        (value, value)
        for value in (
            "image",
            "video",
            "audio",
            "thumbnail",
            "subtitle",
            "background",
            "composition",
        )
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    job = models.ForeignKey(
        GenerationJob, on_delete=models.CASCADE, related_name="assets"
    )
    project = models.ForeignKey(
        AdProject, on_delete=models.CASCADE, related_name="generated_assets"
    )
    asset_type = models.CharField(max_length=30, choices=TYPES)
    file = models.FileField(upload_to="generated/")
    thumbnail_url = models.URLField(blank=True)
    mime_type = models.CharField(max_length=100, blank=True)
    width = models.IntegerField(null=True, blank=True)
    height = models.IntegerField(null=True, blank=True)
    duration_seconds = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True
    )
    file_size = models.BigIntegerField(null=True, blank=True)
    prompt_used = models.TextField(blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    is_favorite = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)


class AssetVariation(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    source_generated_asset = models.ForeignKey(
        GeneratedAsset, on_delete=models.CASCADE, related_name="outgoing_variations"
    )
    variation_generated_asset = models.ForeignKey(
        GeneratedAsset, on_delete=models.CASCADE, related_name="incoming_variations"
    )
    variation_instruction = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["source_generated_asset", "variation_generated_asset"],
                name="unique_asset_variation",
            )
        ]


class AssetFeedback(models.Model):
    FEEDBACK_TYPES = [
        ("like", "Like"),
        ("dislike", "Dislike"),
        ("favorite", "Favorite"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    asset = models.ForeignKey(
        GeneratedAsset, on_delete=models.CASCADE, related_name="feedback"
    )
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    feedback_type = models.CharField(max_length=20, choices=FEEDBACK_TYPES)
    feedback_reason = models.CharField(max_length=100, blank=True)
    comment = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["asset", "user", "feedback_type"],
                name="unique_asset_feedback",
            )
        ]


class DesignComposition(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    ad_project = models.ForeignKey(
        AdProject, on_delete=models.CASCADE, related_name="compositions"
    )
    base_generated_asset = models.ForeignKey(
        GeneratedAsset, on_delete=models.SET_NULL, null=True, blank=True
    )
    canvas_width = models.IntegerField()
    canvas_height = models.IntegerField()
    background_type = models.CharField(max_length=50, blank=True)
    background_value = models.TextField(blank=True)
    version = models.IntegerField(default=1)
    is_current = models.BooleanField(default=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["ad_project", "version"],
                name="unique_project_composition_version",
            )
        ]


class CompositionElement(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    composition = models.ForeignKey(
        DesignComposition, on_delete=models.CASCADE, related_name="elements"
    )
    element_type = models.CharField(max_length=50)
    source_asset = models.ForeignKey(
        BrandAsset, on_delete=models.SET_NULL, null=True, blank=True
    )
    text_content = models.TextField(blank=True)
    x_position = models.DecimalField(
        max_digits=10, decimal_places=4, null=True, blank=True
    )
    y_position = models.DecimalField(
        max_digits=10, decimal_places=4, null=True, blank=True
    )
    width = models.DecimalField(max_digits=10, decimal_places=4, null=True, blank=True)
    height = models.DecimalField(max_digits=10, decimal_places=4, null=True, blank=True)
    rotation = models.DecimalField(max_digits=8, decimal_places=4, default=0)
    z_index = models.IntegerField(default=0, db_index=True)
    font_family = models.CharField(max_length=150, blank=True)
    font_size = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True
    )
    font_weight = models.CharField(max_length=30, blank=True)
    text_color = models.CharField(max_length=20, blank=True)
    background_color = models.CharField(max_length=20, blank=True)
    alignment = models.CharField(max_length=30, blank=True)
    opacity = models.DecimalField(max_digits=5, decimal_places=2, default=1)
    is_locked = models.BooleanField(default=False)
    properties = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)


class VideoProject(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    ad_project = models.OneToOneField(
        AdProject, on_delete=models.CASCADE, related_name="video_project"
    )
    total_duration_seconds = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True
    )
    aspect_ratio = models.CharField(max_length=20, default="9:16")
    fps = models.IntegerField(default=30)
    voiceover_enabled = models.BooleanField(default=False)
    music_enabled = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)


class VideoScene(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    video_project = models.ForeignKey(
        VideoProject, on_delete=models.CASCADE, related_name="scenes"
    )
    scene_order = models.IntegerField()
    scene_type = models.CharField(max_length=50, blank=True)
    duration_seconds = models.DecimalField(max_digits=10, decimal_places=2)
    visual_prompt = models.TextField(blank=True)
    text_overlay = models.TextField(blank=True)
    voiceover_text = models.TextField(blank=True)
    transition_type = models.CharField(max_length=50, blank=True)
    source_asset = models.ForeignKey(
        BrandAsset, on_delete=models.SET_NULL, null=True, blank=True
    )
    generated_asset = models.ForeignKey(
        GeneratedAsset, on_delete=models.SET_NULL, null=True, blank=True
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["video_project", "scene_order"],
                name="unique_video_scene_order",
            )
        ]


class WorkspacePreference(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.OneToOneField(
        Workspace, on_delete=models.CASCADE, related_name="preferences"
    )
    preferred_styles = models.JSONField(default=list, blank=True)
    preferred_backgrounds = models.JSONField(default=list, blank=True)
    preferred_compositions = models.JSONField(default=list, blank=True)
    preferred_text_density = models.CharField(max_length=50, blank=True)
    preferred_product_scale = models.CharField(max_length=50, blank=True)
    learned_preferences = models.JSONField(default=dict, blank=True)
    updated_at = models.DateTimeField(auto_now=True)


class Export(models.Model):
    FORMATS = [
        (value, value) for value in ("png", "jpg", "webp", "mp4", "mov", "pdf")
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.ForeignKey(
        Workspace, on_delete=models.CASCADE, related_name="exports"
    )
    generated_asset = models.ForeignKey(
        GeneratedAsset, on_delete=models.SET_NULL, null=True, blank=True
    )
    composition = models.ForeignKey(
        DesignComposition, on_delete=models.SET_NULL, null=True, blank=True
    )
    exported_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    export_format = models.CharField(max_length=10, choices=FORMATS)
    export_resolution = models.CharField(max_length=50, blank=True)
    exported_at = models.DateTimeField(auto_now_add=True)
