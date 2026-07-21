from django.contrib import admin

from .models import (
    AdProject,
    AdTemplate,
    AssetFeedback,
    BrandAsset,
    BrandKit,
    CreativeRecipe,
    CreativeReference,
    GeneratedAsset,
    GenerationJob,
    Product,
    ProjectInputAsset,
    ProjectReference,
)


admin.site.register(
    [
        BrandKit,
        BrandAsset,
        Product,
        CreativeRecipe,
        CreativeReference,
        AdTemplate,
        AdProject,
        ProjectInputAsset,
        ProjectReference,
        GenerationJob,
        GeneratedAsset,
        AssetFeedback,
    ]
)
