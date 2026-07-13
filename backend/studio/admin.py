from django.contrib import admin
from .models import *
admin.site.register([BrandKit,BrandAsset,Product,CreativeRecipe,AdProject,GenerationJob,GeneratedAsset,AssetFeedback])
