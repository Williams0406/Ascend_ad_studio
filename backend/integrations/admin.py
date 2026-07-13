from django.contrib import admin
from .models import AIProviderConnection


@admin.register(AIProviderConnection)
class AIProviderConnectionAdmin(admin.ModelAdmin):
 list_display=['workspace','provider','status','api_key_last_four','is_default','last_tested_at','updated_at']
 list_filter=['provider','status','is_default']
 search_fields=['workspace__name','api_key_last_four']
 readonly_fields=['encrypted_api_key','api_key_last_four','created_by','created_at','updated_at']
