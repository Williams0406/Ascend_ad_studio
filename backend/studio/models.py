import uuid

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone

from accounts.models import Workspace

FORMAT_CHOICES = [
    ("square", "Cuadrado"),
    ("portrait", "Vertical"),
    ("landscape", "Horizontal"),
    ("widescreen", "Panorámico"),
    ("vertical_fullscreen", "Vertical pantalla completa"),
    ("instagram_post_square", "Instagram · Post cuadrado"),
    ("instagram_post_portrait", "Instagram · Post vertical"),
    ("instagram_post_landscape", "Instagram · Post horizontal"),
    ("instagram_story", "Instagram · Story"),
    ("instagram_reel", "Instagram · Reel"),
    ("instagram_carousel_square", "Instagram · Carrusel cuadrado"),
    ("instagram_carousel_portrait", "Instagram · Carrusel vertical"),
    ("facebook_post_square", "Facebook · Post cuadrado"),
    ("facebook_post_landscape", "Facebook · Post horizontal"),
    ("facebook_story", "Facebook · Story"),
    ("facebook_cover", "Facebook · Portada"),
    ("facebook_event_cover", "Facebook · Portada de evento"),
    ("facebook_ad_square", "Facebook Ads · Cuadrado"),
    ("facebook_ad_portrait", "Facebook Ads · Vertical"),
    ("facebook_ad_landscape", "Facebook Ads · Horizontal"),
    ("linkedin_post_square", "LinkedIn · Post cuadrado"),
    ("linkedin_post_portrait", "LinkedIn · Post vertical"),
    ("linkedin_post_landscape", "LinkedIn · Post horizontal"),
    ("linkedin_link_preview", "LinkedIn · Vista previa de enlace"),
    ("linkedin_profile_cover", "LinkedIn · Portada de perfil"),
    ("linkedin_company_cover", "LinkedIn · Portada de empresa"),
    ("linkedin_article_cover", "LinkedIn · Portada de artículo"),
    ("tiktok_video", "TikTok · Video vertical"),
    ("tiktok_image_post", "TikTok · Publicación de imagen"),
    ("tiktok_ad_vertical", "TikTok Ads · Vertical"),
    ("tiktok_ad_square", "TikTok Ads · Cuadrado"),
    ("tiktok_ad_landscape", "TikTok Ads · Horizontal"),
    ("youtube_thumbnail", "YouTube · Miniatura"),
    ("youtube_video", "YouTube · Video horizontal"),
    ("youtube_short", "YouTube · Short"),
    ("youtube_channel_banner", "YouTube · Banner de canal"),
    ("youtube_podcast_cover", "YouTube · Portada de pódcast"),
    ("x_post_square", "X · Post cuadrado"),
    ("x_post_landscape", "X · Post horizontal"),
    ("x_header", "X · Portada de perfil"),
    ("pinterest_pin", "Pinterest · Pin estándar"),
    ("pinterest_square", "Pinterest · Pin cuadrado"),
    ("pinterest_long_pin", "Pinterest · Pin largo"),
    ("display_banner_300x250", "Display · Rectángulo mediano"),
    ("display_banner_336x280", "Display · Rectángulo grande"),
    ("display_banner_728x90", "Display · Leaderboard"),
    ("display_banner_970x250", "Display · Billboard"),
    ("display_banner_160x600", "Display · Skyscraper"),
    ("display_banner_300x600", "Display · Media página"),
    ("display_banner_320x50", "Display · Banner móvil"),
    ("display_banner_320x100", "Display · Banner móvil grande"),
    ("flyer_a4_portrait", "Flyer A4 · Vertical"),
    ("flyer_a4_landscape", "Flyer A4 · Horizontal"),
    ("presentation_16_9", "Presentación · 16:9"),
    ("presentation_4_3", "Presentación · 4:3"),
    ("email_header", "Email · Cabecera"),
    ("website_hero", "Sitio web · Hero"),
]

FORMAT_SPECS = {
    "square": {"width": 1080, "height": 1080, "aspect_ratio": "1:1"},
    "portrait": {"width": 1080, "height": 1350, "aspect_ratio": "4:5"},
    "landscape": {"width": 1200, "height": 628, "aspect_ratio": "1.91:1"},
    "widescreen": {"width": 1920, "height": 1080, "aspect_ratio": "16:9"},
    "vertical_fullscreen": {"width": 1080, "height": 1920, "aspect_ratio": "9:16"},
    "instagram_post_square": {"width": 1080, "height": 1080, "aspect_ratio": "1:1"},
    "instagram_post_portrait": {"width": 1080, "height": 1350, "aspect_ratio": "4:5"},
    "instagram_post_landscape": {
        "width": 1080,
        "height": 566,
        "aspect_ratio": "1.91:1",
    },
    "instagram_story": {"width": 1080, "height": 1920, "aspect_ratio": "9:16"},
    "instagram_reel": {"width": 1080, "height": 1920, "aspect_ratio": "9:16"},
    "instagram_carousel_square": {"width": 1080, "height": 1080, "aspect_ratio": "1:1"},
    "instagram_carousel_portrait": {
        "width": 1080,
        "height": 1350,
        "aspect_ratio": "4:5",
    },
    "facebook_post_square": {"width": 1080, "height": 1080, "aspect_ratio": "1:1"},
    "facebook_post_landscape": {"width": 1200, "height": 630, "aspect_ratio": "1.91:1"},
    "facebook_story": {"width": 1080, "height": 1920, "aspect_ratio": "9:16"},
    "facebook_cover": {"width": 1640, "height": 624, "aspect_ratio": "2.63:1"},
    "facebook_event_cover": {"width": 1920, "height": 1005, "aspect_ratio": "1.91:1"},
    "facebook_ad_square": {"width": 1080, "height": 1080, "aspect_ratio": "1:1"},
    "facebook_ad_portrait": {"width": 1080, "height": 1350, "aspect_ratio": "4:5"},
    "facebook_ad_landscape": {"width": 1200, "height": 628, "aspect_ratio": "1.91:1"},
    "linkedin_post_square": {"width": 1080, "height": 1080, "aspect_ratio": "1:1"},
    "linkedin_post_portrait": {"width": 1080, "height": 1350, "aspect_ratio": "4:5"},
    "linkedin_post_landscape": {"width": 1200, "height": 627, "aspect_ratio": "1.91:1"},
    "linkedin_link_preview": {"width": 1200, "height": 627, "aspect_ratio": "1.91:1"},
    "linkedin_profile_cover": {"width": 1584, "height": 396, "aspect_ratio": "4:1"},
    "linkedin_company_cover": {"width": 4200, "height": 700, "aspect_ratio": "6:1"},
    "linkedin_article_cover": {"width": 2000, "height": 600, "aspect_ratio": "10:3"},
    "tiktok_video": {"width": 1080, "height": 1920, "aspect_ratio": "9:16"},
    "tiktok_image_post": {"width": 1080, "height": 1920, "aspect_ratio": "9:16"},
    "tiktok_ad_vertical": {"width": 1080, "height": 1920, "aspect_ratio": "9:16"},
    "tiktok_ad_square": {"width": 1080, "height": 1080, "aspect_ratio": "1:1"},
    "tiktok_ad_landscape": {"width": 1920, "height": 1080, "aspect_ratio": "16:9"},
    "youtube_thumbnail": {"width": 3840, "height": 2160, "aspect_ratio": "16:9"},
    "youtube_video": {"width": 1920, "height": 1080, "aspect_ratio": "16:9"},
    "youtube_short": {"width": 1080, "height": 1920, "aspect_ratio": "9:16"},
    "youtube_channel_banner": {"width": 2560, "height": 1440, "aspect_ratio": "16:9"},
    "youtube_podcast_cover": {"width": 1400, "height": 1400, "aspect_ratio": "1:1"},
    "x_post_square": {"width": 1080, "height": 1080, "aspect_ratio": "1:1"},
    "x_post_landscape": {"width": 1600, "height": 900, "aspect_ratio": "16:9"},
    "x_header": {"width": 1500, "height": 500, "aspect_ratio": "3:1"},
    "pinterest_pin": {"width": 1000, "height": 1500, "aspect_ratio": "2:3"},
    "pinterest_square": {"width": 1000, "height": 1000, "aspect_ratio": "1:1"},
    "pinterest_long_pin": {"width": 1000, "height": 2100, "aspect_ratio": "10:21"},
    "display_banner_300x250": {"width": 300, "height": 250, "aspect_ratio": "6:5"},
    "display_banner_336x280": {"width": 336, "height": 280, "aspect_ratio": "6:5"},
    "display_banner_728x90": {"width": 728, "height": 90, "aspect_ratio": "364:45"},
    "display_banner_970x250": {"width": 970, "height": 250, "aspect_ratio": "97:25"},
    "display_banner_160x600": {"width": 160, "height": 600, "aspect_ratio": "4:15"},
    "display_banner_300x600": {"width": 300, "height": 600, "aspect_ratio": "1:2"},
    "display_banner_320x50": {"width": 320, "height": 50, "aspect_ratio": "32:5"},
    "display_banner_320x100": {"width": 320, "height": 100, "aspect_ratio": "16:5"},
    "flyer_a4_portrait": {"width": 2480, "height": 3508, "aspect_ratio": "1:1.414"},
    "flyer_a4_landscape": {"width": 3508, "height": 2480, "aspect_ratio": "1.414:1"},
    "presentation_16_9": {"width": 1920, "height": 1080, "aspect_ratio": "16:9"},
    "presentation_4_3": {"width": 1600, "height": 1200, "aspect_ratio": "4:3"},
    "email_header": {"width": 1200, "height": 400, "aspect_ratio": "3:1"},
    "website_hero": {"width": 1920, "height": 800, "aspect_ratio": "12:5"},
}

PURPOSE_CHOICES = [
    ("background", "Background"),
    ("logo", "Logo"),
    ("icon", "Icon"),
    ("lifestyle", "Lifestyle"),
    ("persona", "Persona"),
    ("pose", "Pose"),
    ("mood", "Mood"),
    ("packaging", "Packaging"),
    ("template", "Template"),
    ("style", "Style"),
    ("composition", "Composition"),
    ("lighting", "Lighting"),
    ("color", "Color"),
    ("typography", "Typography"),
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
    logo_url = models.ForeignKey(
        "BrandAsset",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="brand_kits_logo",
        limit_choices_to={"category": "logo"},
    )
    logo_dark_url = models.ForeignKey(
        "BrandAsset",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="brand_kits_dark_logo",
        limit_choices_to={"category": "logo"},
    )
    logo_light_url = models.ForeignKey(
        "BrandAsset",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="brand_kits_light_logo",
        limit_choices_to={"category": "logo"},
    )
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
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)


class BrandIntelligenceProfile(models.Model):
    """
    Perfil reutilizable de audiencia y dirección creativa generado
    a partir del BrandKit y notas de investigación del workspace.

    No pertenece a un AdProject específico.
    """

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )

    workspace = models.ForeignKey(
        Workspace,
        on_delete=models.CASCADE,
        related_name="brand_intelligence_profiles",
    )

    persona = models.TextField()

    pain_point = models.TextField()

    angle = models.TextField()

    visual_direction = models.TextField(blank=True)

    emotion = models.CharField(
        max_length=150,
        blank=True,
    )

    copy_hook = models.TextField(blank=True)

    is_active = models.BooleanField(
        default=True,
        db_index=True,
    )

    metadata = models.JSONField(
        default=dict,
        blank=True,
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    updated_at = models.DateTimeField(
        auto_now=True,
    )

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(
                fields=["workspace", "is_active"],
                name="bip_ws_active_idx",
            ),
        ]

    def __str__(self):
        persona_preview = self.persona[:70]
        return f"{self.workspace.name} · {persona_preview}"


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
    CATEGORIES = [
        (value, value)
        for value in (
            "lifestyle",
            "persona",
            "reference_ad",
            "template",
            "background",
            "packaging",
            "icon",
        )
    ]

    workspace = models.ForeignKey(
        Workspace,
        on_delete=models.CASCADE,
        related_name="creative_references",
    )
    title = models.CharField(max_length=255)
    category = models.CharField(
        max_length=30, choices=CATEGORIES, default="reference_ad"
    )
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
    description = models.TextField(blank=True)
    visual_structure = models.TextField(
        blank=True,
        help_text=(
            "Descripción estructurada de la composición visual " "de la plantilla."
        ),
    )

    copy_structure = models.TextField(
        blank=True,
        help_text=("Jerarquía y distribución recomendada del copy."),
    )

    prompt_guidance = models.TextField(
        blank=True,
        help_text=(
            "Guía reutilizable para convertir esta plantilla "
            "en instrucciones de generación."
        ),
    )

    do_rules = models.JSONField(
        default=list,
        blank=True,
        help_text=("Reglas visuales o compositivas que deben respetarse."),
    )

    dont_rules = models.JSONField(
        default=list,
        blank=True,
        help_text=("Reglas visuales o compositivas que deben evitarse."),
    )
    format = models.CharField(
        max_length=60,
        choices=FORMAT_CHOICES,
        default="portrait",
    )

    layout_constraints = models.JSONField(
        default=dict,
        blank=True,
        help_text=(
            "Restricciones estructurales duras y verificables "
            "de la plantilla. Deben limitarse a reglas de layout "
            "que no deban ser reinterpretadas creativamente."
        ),
    )
    is_favorite = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def clean(self):
        super().clean()

        if self.layout_constraints and not isinstance(
            self.layout_constraints,
            dict,
        ):
            raise ValidationError(
                {
                    "layout_constraints": (
                        "layout_constraints debe ser " "un objeto JSON."
                    )
                }
            )


class AdTemplateExampleImage(models.Model):
    """
    Imagen de ejemplo reutilizable asociada a una plantilla creativa.

    La imagen vive como CreativeReference para conservar metadatos,
    fuente, notas y archivo original sin duplicarlo.
    """

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )

    ad_template = models.ForeignKey(
        AdTemplate,
        on_delete=models.CASCADE,
        related_name="example_images",
    )

    image = models.ForeignKey(
        CreativeReference,
        on_delete=models.PROTECT,
        related_name="template_example_usages",
        limit_choices_to={
            "category": "template",
        },
    )

    gemini_vision_notes = models.TextField(
        blank=True,
    )

    sort_order = models.PositiveIntegerField(
        default=0,
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    updated_at = models.DateTimeField(
        auto_now=True,
    )

    class Meta:
        ordering = [
            "sort_order",
            "created_at",
        ]

        constraints = [
            models.UniqueConstraint(
                fields=[
                    "ad_template",
                    "image",
                ],
                name="uniq_template_example",
            ),
        ]

        indexes = [
            models.Index(
                fields=[
                    "ad_template",
                    "sort_order",
                ],
                name="tpl_example_order_idx",
            ),
        ]

    def clean(self):
        super().clean()

        if (
            self.ad_template_id
            and self.image_id
            and self.ad_template.workspace_id != self.image.workspace_id
        ):
            raise ValidationError(
                "La imagen de ejemplo debe pertenecer "
                "al mismo workspace que la plantilla."
            )

        if self.image_id and self.image.category != "template":
            raise ValidationError(
                "La CreativeReference usada como ejemplo "
                "debe tener category=template."
            )

    def __str__(self):
        return f"{self.ad_template.name} · " f"{self.image.title}"


class ConceptPlan(models.Model):
    """
    Plan creativo previo a la generación de imágenes.

    Un ConceptPlan pertenece al workspace, pero todavía no crea
    GenerationJob. La expansión a jobs ocurre en la Pieza D.
    """

    STATUSES = [
        ("ready", "Listo"),
        ("generated", "Generado"),
        ("failed", "Fallido"),
        ("cancelled", "Cancelado"),
    ]

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )

    workspace = models.ForeignKey(
        Workspace,
        on_delete=models.CASCADE,
        related_name="concept_plans",
    )

    project = models.ForeignKey(
        "AdProject",
        on_delete=models.CASCADE,
        related_name="concept_plans",
        null=True,
        blank=True,
        help_text=(
            "AdProject que proporciona producto, recursos, "
            "referencias y contexto de producción al plan."
        ),
    )

    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="requested_concept_plans",
    )

    total_ads_requested = models.PositiveIntegerField()

    status = models.CharField(
        max_length=20,
        choices=STATUSES,
        default="ready",
        db_index=True,
    )

    plan_data = models.JSONField(
        default=dict,
        blank=True,
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    updated_at = models.DateTimeField(
        auto_now=True,
    )

    class Meta:
        ordering = [
            "-created_at",
        ]

        indexes = [
            models.Index(
                fields=[
                    "workspace",
                    "status",
                ],
                name="concept_ws_status_idx",
            ),
            models.Index(
                fields=[
                    "workspace",
                    "-created_at",
                ],
                name="concept_ws_created_idx",
            ),
        ]

    def __str__(self):
        return f"{self.workspace.name} · " f"{self.total_ads_requested} anuncios"


class AdProject(models.Model):
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
    message_type = models.CharField(max_length=100, blank=True)
    campaign_theme = models.CharField(max_length=255, blank=True)
    headline = models.TextField(blank=True)
    offer_text = models.TextField(blank=True)
    call_to_action = models.CharField(max_length=255, blank=True)
    focus_tags = models.JSONField(default=list, blank=True)
    use_brand_kit = models.BooleanField(default=True)
    status = models.CharField(max_length=20, choices=STATUSES, default="draft")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def clean(self):
        super().clean()
        if self.use_brand_kit:
            self.call_to_action = ""


class Purpose(models.Model):
    code = models.CharField(max_length=40, choices=PURPOSE_CHOICES, unique=True)
    label = models.CharField(max_length=80)

    def __str__(self):
        return self.label


class ProjectInputAsset(models.Model):
    INPUT_ROLES = [
        ("product_image", "Imagen del producto"),
        ("logo", "Logo"),
        ("background", "Fondo"),
        ("lifestyle_reference", "Referencia de estilo de vida"),
        ("character_reference", "Referencia de personaje"),
        ("template", "Plantilla"),
        ("packaging", "Empaque"),
        ("reference_ad", "Referencia publicitaria"),
        ("icon", "Icono"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    ad_project = models.ForeignKey(
        AdProject, on_delete=models.CASCADE, related_name="input_assets"
    )
    brand_asset = models.ForeignKey(
        BrandAsset, on_delete=models.CASCADE, related_name="project_inputs"
    )
    input_role = models.CharField(max_length=50, choices=INPUT_ROLES)
    purpose = models.ManyToManyField(Purpose, blank=True, related_name="input_assets")
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
    INPUT_ROLES = [
        ("background", "Fondo"),
        ("lifestyle_reference", "Referencia de estilo de vida"),
        ("character_reference", "Referencia de personaje"),
        ("template", "Plantilla"),
        ("packaging", "Empaque"),
        ("icon", "Icono"),
        ("reference_ad", "Referencia publicitaria"),
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
    input_role = models.CharField(
        max_length=50, choices=INPUT_ROLES, default="reference_ad"
    )
    purpose = models.ManyToManyField(
        Purpose, blank=True, related_name="project_references"
    )


class GenerationBatch(models.Model):
    STATUSES = [
        (value, value)
        for value in (
            "draft",
            "queued",
            "processing",
            "completed",
            "partial",
            "failed",
            "cancelled",
        )
    ]
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(
        AdProject, on_delete=models.CASCADE, related_name="generation_batches"
    )
    concept_plan = models.OneToOneField(
        ConceptPlan,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="generation_batch",
    )
    requested_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    session_id = models.UUIDField(null=True, blank=True, db_index=True)
    name = models.CharField(max_length=255, blank=True)
    status = models.CharField(max_length=20, choices=STATUSES, default="draft")
    total_jobs = models.PositiveIntegerField(default=0)
    completed_jobs = models.PositiveIntegerField(default=0)
    failed_jobs = models.PositiveIntegerField(default=0)
    metadata = models.JSONField(default=dict, blank=True)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["project", "status"]),
            models.Index(fields=["status", "-created_at"]),
        ]

    def __str__(self):
        return self.name or f"{self.project.name} · {self.created_at:%Y-%m-%d %H:%M}"


class GenerationJob(models.Model):
    STATUSES = [
        (value, value)
        for value in (
            "draft",
            "queued",
            "processing",
            "completed",
            "failed",
            "cancelled",
        )
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(
        AdProject, on_delete=models.CASCADE, related_name="jobs"
    )
    product = models.ForeignKey(
        Product, on_delete=models.SET_NULL, null=True, blank=True
    )
    template = models.ForeignKey(
        AdTemplate, on_delete=models.SET_NULL, null=True, blank=True
    )
    recipe = models.ForeignKey(
        CreativeRecipe, on_delete=models.SET_NULL, null=True, blank=True
    )
    creative_angle = models.ForeignKey(
        CreativeAngle, on_delete=models.SET_NULL, null=True, blank=True
    )
    concept_index = models.PositiveIntegerField(
        null=True,
        blank=True,
        db_index=True,
        help_text=(
            "Índice 1-based del concepto dentro " "del ConceptPlan que originó el job."
        ),
    )

    format_used = models.ForeignKey(
        AdTemplate,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="format_generation_jobs",
        help_text=(
            "Plantilla seleccionada por el Concept Planner " "para este concepto."
        ),
    )

    profile_used = models.ForeignKey(
        BrandIntelligenceProfile,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="generation_jobs",
        help_text=(
            "Perfil de Brand Intelligence utilizado " "para producir este anuncio."
        ),
    )

    body_copy_primary = models.TextField(
        blank=True,
    )

    body_copy_variant_a = models.TextField(
        blank=True,
    )

    hook_variant = models.TextField(
        blank=True,
    )

    rationale = models.TextField(
        blank=True,
    )
    name = models.CharField(max_length=255, blank=True)
    message_type = models.CharField(max_length=100, blank=True)
    campaign_theme = models.CharField(max_length=255, blank=True)
    headline = models.TextField(blank=True)
    offer_text = models.TextField(blank=True)
    call_to_action = models.CharField(max_length=255, blank=True)
    target_audience = models.TextField(blank=True)
    focus_tags = models.JSONField(default=list, blank=True)
    use_brand_kit = models.BooleanField(default=True)
    batch = models.ForeignKey(
        GenerationBatch,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="jobs",
    )
    requested_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    session_id = models.UUIDField(null=True, blank=True, db_index=True)
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
    prompt = models.TextField(
        help_text="Brief determinístico producido por la Etapa 1.",
    )

    composed_prompt = models.TextField(
        null=True,
        blank=True,
        help_text="Prompt final producido por Gemini en la Etapa 2.",
    )

    negative_prompt = models.TextField(blank=True)
    parameters = models.JSONField(default=dict, blank=True)
    number_of_outputs = models.PositiveIntegerField(default=1)
    status = models.CharField(max_length=20, choices=STATUSES, default="draft")
    provider_request_id = models.CharField(max_length=255, blank=True)
    error_message = models.TextField(blank=True)
    retry_count = models.PositiveIntegerField(default=0)
    queue_position = models.PositiveIntegerField(null=True, blank=True)
    priority = models.PositiveSmallIntegerField(default=5)
    prompt_modifier = models.TextField(blank=True)
    cancel_requested = models.BooleanField(default=False)
    updated_at = models.DateTimeField(auto_now=True)
    started_at = models.DateTimeField(null=True, blank=True)
    enqueued_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)


class GeneratedAsset(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    job = models.ForeignKey(
        GenerationJob, on_delete=models.CASCADE, related_name="assets"
    )
    project = models.ForeignKey(
        AdProject, on_delete=models.CASCADE, related_name="generated_assets"
    )
    file = models.FileField(upload_to="generated/")
    thumbnail_url = models.URLField(blank=True)
    mime_type = models.CharField(max_length=100, blank=True)
    width = models.IntegerField(null=True, blank=True)
    height = models.IntegerField(null=True, blank=True)
    file_size = models.BigIntegerField(null=True, blank=True)
    prompt_used = models.TextField(blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    is_favorite = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)


class GenerationJobInputAsset(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    generation_job = models.ForeignKey(
        GenerationJob, on_delete=models.CASCADE, related_name="input_assets"
    )
    brand_asset = models.ForeignKey(
        BrandAsset, on_delete=models.CASCADE, related_name="generation_job_inputs"
    )
    input_role = models.CharField(max_length=50, choices=ProjectInputAsset.INPUT_ROLES)
    purpose = models.ManyToManyField(
        Purpose, blank=True, related_name="generation_job_input_assets"
    )
    sort_order = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["generation_job", "brand_asset", "input_role"],
                name="unique_generation_job_input_asset_role",
            )
        ]


class GenerationJobReference(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    generation_job = models.ForeignKey(
        GenerationJob, on_delete=models.CASCADE, related_name="references"
    )
    reference = models.ForeignKey(
        CreativeReference,
        on_delete=models.CASCADE,
        related_name="generation_job_references",
    )
    weight = models.PositiveSmallIntegerField(default=100)
    input_role = models.CharField(
        max_length=50, choices=ProjectReference.INPUT_ROLES, default="reference_ad"
    )
    purpose = models.ManyToManyField(
        Purpose, blank=True, related_name="generation_job_references"
    )


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


class WorkspacePreference(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.OneToOneField(
        Workspace, on_delete=models.CASCADE, related_name="preferences"
    )
    learned_preferences = models.JSONField(default=dict, blank=True)
    updated_at = models.DateTimeField(auto_now=True)


class Export(models.Model):
    FORMATS = [(value, value) for value in ("png", "jpg", "webp", "mp4", "mov", "pdf")]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.ForeignKey(
        Workspace, on_delete=models.CASCADE, related_name="exports"
    )
    generated_asset = models.ForeignKey(
        GeneratedAsset, on_delete=models.SET_NULL, null=True, blank=True
    )
    exported_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    export_format = models.CharField(max_length=10, choices=FORMATS)
    export_resolution = models.CharField(max_length=50, blank=True)
    exported_at = models.DateTimeField(auto_now_add=True)
