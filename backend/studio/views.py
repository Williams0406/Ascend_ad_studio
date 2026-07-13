from django.shortcuts import get_object_or_404
from rest_framework.exceptions import NotFound
from rest_framework import viewsets,status
from rest_framework.decorators import action
from rest_framework.response import Response
from accounts.models import Workspace
from billing.services import consume_credits
from integrations.models import AIProviderConnection
from .models import *
from .serializers import *
from .permissions import WorkspaceAccess
from .services.generation import MockGenerationProvider

ALLOWED_AI_MODELS={
 'gemini':{
  'gemini-image-standard':{'provider_model':'gemini-image-standard','label':'Imagen estándar','media_type':'image'},
 },
 'fal':{
  'flux-fast':{'provider_model':'fal-ai/flux/schnell','label':'Imagen rápida','media_type':'image'},
  'flux-quality':{'provider_model':'fal-ai/flux-pro','label':'Imagen alta calidad','media_type':'image'},
 }
}

class WorkspaceScopedMixin:
 permission_classes=[WorkspaceAccess]
 def workspace(self):
  wid=self.request.headers.get('X-Workspace-ID') or self.request.query_params.get('workspace_id')
  if not wid: raise NotFound('Workspace requerido.')
  return get_object_or_404(Workspace,id=wid)
class BrandKitViewSet(WorkspaceScopedMixin,viewsets.ModelViewSet):
 serializer_class=BrandKitSerializer
 def get_queryset(self): return BrandKit.objects.filter(workspace=self.workspace())
 def perform_create(self,s): s.save(workspace=self.workspace())
class ProductViewSet(WorkspaceScopedMixin,viewsets.ModelViewSet):
 serializer_class=ProductSerializer
 def get_queryset(self): return Product.objects.filter(workspace=self.workspace()).order_by('-created_at')
 def perform_create(self,s): s.save(workspace=self.workspace())
class RecipeViewSet(WorkspaceScopedMixin,viewsets.ReadOnlyModelViewSet):
 serializer_class=CreativeRecipeSerializer
 def get_queryset(self): return CreativeRecipe.objects.filter(is_active=True).filter(models.Q(workspace=self.workspace())|models.Q(is_system_recipe=True))
class ProjectViewSet(WorkspaceScopedMixin,viewsets.ModelViewSet):
 serializer_class=AdProjectSerializer
 def get_serializer_context(self):
  context=super().get_serializer_context(); context['workspace']=self.workspace(); return context
 def get_queryset(self): return AdProject.objects.filter(workspace=self.workspace()).order_by('-created_at')
 def perform_create(self,s): s.save(workspace=self.workspace(),created_by=self.request.user)
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
  prompt=f"Crea {project.content_type} para {project.product.name if project.product else project.name}. Headline: {project.headline}. Oferta: {project.offer_text}. CTA: {project.call_to_action}. Público: {project.target_audience}. Formato: {project.aspect_ratio}."
  job=GenerationJob.objects.create(project=project,requested_by=request.user,provider_connection=connection,provider=provider,model_name=model_name,prompt=prompt,parameters={'model_code':model_code},number_of_outputs=count,status='processing')
  project.status='generating'; project.save(update_fields=['status'])
  try: MockGenerationProvider().generate(job)
  except Exception as exc: job.status='failed'; job.error_message=str(exc); job.save(update_fields=['status','error_message']); return Response({'detail':str(exc)},status=500)
  return Response(GenerationJobSerializer(job,context={'request':request}).data,status=status.HTTP_201_CREATED)
