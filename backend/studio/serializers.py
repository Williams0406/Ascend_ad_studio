from rest_framework import serializers
from .models import *
class BrandKitSerializer(serializers.ModelSerializer):
 class Meta: model=BrandKit; fields='__all__'; read_only_fields=['workspace']
class ProductSerializer(serializers.ModelSerializer):
 class Meta: model=Product; fields='__all__'; read_only_fields=['workspace']
class CreativeRecipeSerializer(serializers.ModelSerializer):
 class Meta: model=CreativeRecipe; fields='__all__'
class GeneratedAssetSerializer(serializers.ModelSerializer):
 file_url=serializers.SerializerMethodField()
 class Meta: model=GeneratedAsset; fields=['id','asset_type','file','file_url','prompt_used','metadata','is_favorite','created_at']
 def get_file_url(self,obj):
  r=self.context.get('request'); return r.build_absolute_uri(obj.file.url) if r and obj.file else None
class GenerationJobSerializer(serializers.ModelSerializer):
 assets=GeneratedAssetSerializer(many=True,read_only=True)
 class Meta: model=GenerationJob; fields=['id','provider','model_name','provider_request_id','estimated_cost_usd','actual_cost_usd','prompt','number_of_outputs','status','error_message','created_at','completed_at','assets']
class AdProjectSerializer(serializers.ModelSerializer):
 jobs=GenerationJobSerializer(many=True,read_only=True)
 class Meta: model=AdProject; fields='__all__'; read_only_fields=['workspace','created_by','status']
 def validate_product(self,value):
  workspace=self.context.get('workspace')
  if value and workspace and value.workspace_id != workspace.id:
   raise serializers.ValidationError('El producto no pertenece al workspace activo.')
  return value
 def validate_recipe(self,value):
  workspace=self.context.get('workspace')
  if value and workspace and value.workspace_id and value.workspace_id != workspace.id:
   raise serializers.ValidationError('La receta no pertenece al workspace activo.')
  return value
class GenerateSerializer(serializers.Serializer):
 number_of_outputs=serializers.IntegerField(min_value=1,max_value=6,default=3)
 provider=serializers.ChoiceField(choices=['auto','gemini','fal'],default='auto')
 model_code=serializers.CharField(required=False,allow_blank=True,default='')
