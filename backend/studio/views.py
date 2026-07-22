import requests as http_requests

from django.conf import settings
from django.db import IntegrityError
from django.shortcuts import get_object_or_404
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework import viewsets,status
from rest_framework.decorators import action
from rest_framework.response import Response
from accounts.models import Workspace
from billing.services import consume_credits, refund_generation_credits
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

ALLOWED_AI_MODELS={
 'gemini':{code:{'provider_model':code,'label':label,'media_type':'image'} for code,label in GEMINI_IMAGE_MODELS.items()},
 'fal':{
  'flux-fast':{'provider_model':'fal-ai/flux/schnell','label':FAL_IMAGE_MODELS['flux-fast'],'media_type':'image'},
  'flux-quality':{'provider_model':'fal-ai/flux-pro','label':FAL_IMAGE_MODELS['flux-quality'],'media_type':'image'},
 },
}

class WorkspaceScopedMixin:
 permission_classes=[WorkspaceAccess]
 def workspace(self):
  wid=self.request.headers.get('X-Workspace-ID') or self.request.query_params.get('workspace_id')
  if not wid: raise NotFound('Workspace requerido.')
  return get_object_or_404(Workspace,id=wid)
class BrandKitViewSet(WorkspaceScopedMixin,viewsets.ModelViewSet):
 serializer_class=BrandKitSerializer
 def get_queryset(self): return BrandKit.objects.filter(workspace=self.workspace()).order_by('created_at')
 def perform_create(self,s): s.save(workspace=self.workspace())
 @action(detail=False,methods=['get'],url_path='google-fonts')
 def google_fonts(self,request):
  fallback=['Inter','Roboto','Open Sans','Lato','Montserrat','Poppins','Raleway','Nunito','Playfair Display','Merriweather','DM Sans','DM Serif Display','Oswald','Source Sans 3','Libre Baskerville','Work Sans','Manrope','Rubik','Fira Sans','Bebas Neue']
  if not settings.GOOGLE_FONTS_API_KEY:
   return Response({'items':fallback,'catalog_complete':False,'detail':'Configura GOOGLE_FONTS_API_KEY para cargar el catálogo completo.'})
  try:
   response=http_requests.get('https://www.googleapis.com/webfonts/v1/webfonts',params={'key':settings.GOOGLE_FONTS_API_KEY,'sort':'popularity'},timeout=8)
   response.raise_for_status()
   return Response({'items':[item['family'] for item in response.json().get('items',[])],'catalog_complete':True})
  except http_requests.RequestException:
   return Response({'items':fallback,'catalog_complete':False,'detail':'No se pudo actualizar Google Fonts; se muestra el catálogo local.'})
class BrandRuleViewSet(WorkspaceScopedMixin,viewsets.ModelViewSet):
 serializer_class=BrandRuleSerializer
 def get_queryset(self): return BrandRule.objects.filter(brand_kit__workspace=self.workspace()).order_by('created_at')
 def perform_create(self,s):
  kit=get_object_or_404(BrandKit,workspace=self.workspace())
  s.save(brand_kit=kit)
class WorkspacePreferenceViewSet(WorkspaceScopedMixin,viewsets.ModelViewSet):
 serializer_class=WorkspacePreferenceSerializer
 def get_queryset(self): return WorkspacePreference.objects.filter(workspace=self.workspace())
 def perform_create(self,s): s.save(workspace=self.workspace())
class BrandAssetViewSet(WorkspaceScopedMixin,viewsets.ModelViewSet):
 serializer_class=BrandAssetSerializer
 def get_queryset(self): return BrandAsset.objects.filter(workspace=self.workspace()).order_by('-created_at')
 def perform_create(self,s):
  upload=self.request.FILES.get('file')
  values={'workspace':self.workspace(),'uploaded_by':self.request.user}
  if upload:
   values.update({'file_size':upload.size,'mime_type':upload.content_type or ''})
   try:
    from PIL import Image
    image=Image.open(upload); values.update({'width':image.width,'height':image.height}); upload.seek(0)
   except Exception:
    pass
  s.save(**values)
class CreativeReferenceViewSet(WorkspaceScopedMixin,viewsets.ModelViewSet):
 serializer_class=CreativeReferenceSerializer
 def get_queryset(self): return CreativeReference.objects.filter(workspace=self.workspace()).order_by('-created_at')
 def perform_create(self,s): s.save(workspace=self.workspace(),created_by=self.request.user)
class ProductViewSet(WorkspaceScopedMixin,viewsets.ModelViewSet):
 serializer_class=ProductSerializer
 def get_queryset(self): return Product.objects.filter(workspace=self.workspace()).select_related('main_image_asset').prefetch_related('image_assets').order_by('-created_at')
 def perform_create(self,s): s.save(workspace=self.workspace())
class CreativeAngleViewSet(WorkspaceScopedMixin,viewsets.ModelViewSet):
 serializer_class=CreativeAngleSerializer
 def get_queryset(self):
  self.workspace()
  return CreativeAngle.objects.all().order_by('name')
class RecipeViewSet(WorkspaceScopedMixin,viewsets.ModelViewSet):
 serializer_class=CreativeRecipeSerializer
 def get_queryset(self): return CreativeRecipe.objects.filter(models.Q(workspace=self.workspace())|models.Q(is_system_recipe=True)).select_related('creative_angle').order_by('-is_system_recipe','name')
 def perform_create(self,s): s.save(workspace=self.workspace(),created_by=self.request.user,is_system_recipe=False)
 def perform_update(self,s):
  if s.instance.workspace_id != self.workspace().id: raise PermissionDenied('Las recetas del sistema no se pueden modificar.')
  s.save()
 def perform_destroy(self,instance):
  if instance.workspace_id != self.workspace().id: raise PermissionDenied('Las recetas del sistema no se pueden eliminar.')
  instance.delete()
class AdTemplateViewSet(WorkspaceScopedMixin,viewsets.ModelViewSet):
 serializer_class=AdTemplateSerializer
 def get_queryset(self): return AdTemplate.objects.filter(workspace=self.workspace()).select_related('source_asset').order_by('-created_at')
 def perform_create(self,s): s.save(workspace=self.workspace(),created_by=self.request.user)
class GenerationJobViewSet(WorkspaceScopedMixin,viewsets.ReadOnlyModelViewSet):
 serializer_class=GenerationJobSerializer
 def get_queryset(self): return GenerationJob.objects.filter(project__workspace=self.workspace()).select_related('project','requested_by','provider_connection').prefetch_related('assets').order_by('-created_at')
class GeneratedAssetViewSet(WorkspaceScopedMixin,viewsets.ReadOnlyModelViewSet):
 serializer_class=GeneratedAssetSerializer
 def get_queryset(self): return GeneratedAsset.objects.filter(project__workspace=self.workspace()).select_related('project','job').order_by('-created_at')
class ProjectViewSet(WorkspaceScopedMixin,viewsets.ModelViewSet):
 serializer_class=AdProjectSerializer
 def get_serializer_context(self):
  context=super().get_serializer_context(); context['workspace']=self.workspace(); return context
 def get_queryset(self): return AdProject.objects.filter(workspace=self.workspace()).select_related('product','template','recipe','creative_angle').prefetch_related('input_assets__brand_asset','jobs__assets').order_by('-created_at')
 def perform_create(self,s): s.save(workspace=self.workspace(),created_by=self.request.user)
 @action(detail=True,methods=['post'],url_path='input-assets')
 def add_input_asset(self,request,pk=None):
  project=self.get_object()
  asset=get_object_or_404(BrandAsset,id=request.data.get('brand_asset'),workspace=project.workspace)
  serializer=ProjectInputAssetSerializer(data=request.data,context={'request':request})
  serializer.is_valid(raise_exception=True)
  try:
   input_asset=serializer.save(ad_project=project,brand_asset=asset)
  except IntegrityError:
   return Response({'detail':'Este recurso ya está asignado con el mismo rol.'},status=status.HTTP_409_CONFLICT)
  return Response(ProjectInputAssetSerializer(input_asset,context={'request':request}).data,status=status.HTTP_201_CREATED)
 @action(detail=True,methods=['delete'],url_path=r'input-assets/(?P<input_asset_id>[^/.]+)')
 def remove_input_asset(self,request,pk=None,input_asset_id=None):
  project=self.get_object()
  input_asset=get_object_or_404(ProjectInputAsset,id=input_asset_id,ad_project=project)
  input_asset.delete()
  return Response(status=status.HTTP_204_NO_CONTENT)
 @action(detail=True,methods=['post'],url_path='references')
 def add_reference(self,request,pk=None):
  project=self.get_object()
  reference=get_object_or_404(CreativeReference,id=request.data.get('reference'),workspace=project.workspace)
  if ProjectReference.objects.filter(ad_project=project,reference=reference,purpose=request.data.get('purpose')).exists():
   return Response({'detail':'Esta referencia ya está asignada con el mismo propósito.'},status=status.HTTP_409_CONFLICT)
  serializer=ProjectReferenceSerializer(data=request.data,context={'request':request})
  serializer.is_valid(raise_exception=True)
  project_reference=serializer.save(ad_project=project,reference=reference)
  return Response(ProjectReferenceSerializer(project_reference,context={'request':request}).data,status=status.HTTP_201_CREATED)
 @action(detail=True,methods=['delete'],url_path=r'references/(?P<project_reference_id>[^/.]+)')
 def remove_reference(self,request,pk=None,project_reference_id=None):
  project=self.get_object()
  project_reference=get_object_or_404(ProjectReference,id=project_reference_id,ad_project=project)
  project_reference.delete()
  return Response(status=status.HTTP_204_NO_CONTENT)
 @action(detail=True,methods=['post'])
 def generate(self,request,pk=None):
  project=self.get_object(); serializer=GenerateSerializer(data=request.data); serializer.is_valid(raise_exception=True); count=serializer.validated_data['number_of_outputs']; provider=serializer.validated_data['provider']; model_code=serializer.validated_data.get('model_code') or ''
  qs=AIProviderConnection.objects.filter(workspace=project.workspace,status=AIProviderConnection.Status.ACTIVE)
  connection=qs.filter(is_default=True).first() if provider == 'auto' else qs.filter(provider=provider).first()
  connection=connection or qs.first()
  if not connection:
   return Response({'detail':'Conecta Gemini o fal.ai en Configuración > Integraciones antes de generar.'},status=400)
  provider=connection.provider
  models_for_provider=ALLOWED_AI_MODELS.get(provider,{})
  if not model_code:
   model_code=next(iter(models_for_provider),'')
  if model_code not in models_for_provider:
   return Response({'detail':'Modelo no permitido para este proveedor.'},status=400)
  model_name=models_for_provider[model_code]['provider_model']
  consume_credits(project.workspace,request.user,count*10)
  prompt=build_generation_prompt(project)
  job=GenerationJob.objects.create(project=project,requested_by=request.user,provider_connection=connection,provider=provider,model_name=model_name,prompt=prompt,parameters={'schema_version':1,'model_code':model_code,'aspect_ratio':project.aspect_ratio,'resolution':project.resolution,'quality_mode':project.quality_mode,'output_format':'png'},number_of_outputs=count,status='processing',credits_consumed=count*10)
  project.status='generating'; project.save(update_fields=['status'])
  try:
   if settings.USE_MOCK_AI_GENERATION:
    MockGenerationProvider().generate(job)
   elif provider == AIProviderConnection.Provider.GEMINI:
    GeminiGenerationProvider(connection).generate(job)
   else:
    MockGenerationProvider().generate(job)
  except GenerationProviderError as exc:
   job.status='failed'; job.error_message=str(exc); job.save(update_fields=['status','error_message'])
   refund_generation_credits(job)
   project.status='ready'; project.save(update_fields=['status'])
   return Response({'detail':str(exc)},status=status.HTTP_502_BAD_GATEWAY)
  except Exception as exc:
   job.status='failed'; job.error_message='Error interno durante la generación.'; job.save(update_fields=['status','error_message'])
   refund_generation_credits(job)
   project.status='ready'; project.save(update_fields=['status'])
   return Response({'detail':'No se pudo completar la generación.'},status=status.HTTP_500_INTERNAL_SERVER_ERROR)
  return Response(GenerationJobSerializer(job,context={'request':request}).data,status=status.HTTP_201_CREATED)
