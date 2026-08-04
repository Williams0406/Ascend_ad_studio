from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView
from access_control.permissions import HasWorkspacePlatformAccess
from accounts.models import Workspace,WorkspaceMember
from .models import AIProviderConnection
from .serializers import AIProviderConnectionSerializer,ConnectAIProviderSerializer
from .services.encryption import decrypt_api_key
from .services.validation import validate_provider_key
from .services.models import available_provider_models


class WorkspaceOwnerOrAdminMixin:
 def workspace(self):
  wid=self.request.headers.get('X-Workspace-ID') or self.request.query_params.get('workspace_id')
  workspace=get_object_or_404(Workspace,id=wid)
  membership=WorkspaceMember.objects.filter(workspace=workspace,user=self.request.user,is_active=True).first()
  if not membership or membership.role not in ['owner','admin']:
   raise PermissionDenied('Solo owner o admin pueden configurar integraciones.')
  return workspace


class ProviderConnectionsView(WorkspaceOwnerOrAdminMixin,APIView):
 permission_classes=[HasWorkspacePlatformAccess]
 def get(self,request):
  connections=AIProviderConnection.objects.filter(workspace=self.workspace()).order_by('provider')
  return Response(AIProviderConnectionSerializer(connections,many=True).data)

 def post(self,request):
  workspace=self.workspace()
  serializer=ConnectAIProviderSerializer(data=request.data,context={'request':request,'workspace':workspace})
  serializer.is_valid(raise_exception=True)
  connection=serializer.save()
  return Response(AIProviderConnectionSerializer(connection).data,status=status.HTTP_201_CREATED)


class ProviderConnectionDetailView(WorkspaceOwnerOrAdminMixin,APIView):
 permission_classes=[HasWorkspacePlatformAccess]
 def connection(self,connection_id):
  return get_object_or_404(AIProviderConnection,id=connection_id,workspace=self.workspace())

 def delete(self,request,connection_id):
  connection=self.connection(connection_id)
  connection.status=AIProviderConnection.Status.REVOKED
  connection.encrypted_api_key=''
  connection.is_default=False
  connection.save(update_fields=['status','encrypted_api_key','is_default','updated_at'])
  return Response(status=status.HTTP_204_NO_CONTENT)


class TestProviderConnectionView(ProviderConnectionDetailView):
 def post(self,request,connection_id):
  connection=self.connection(connection_id)
  if not connection.encrypted_api_key:
   return Response({'valid':False,'error':'La conexión no tiene una clave activa.'},status=400)
  result=validate_provider_key(connection.provider,decrypt_api_key(connection.encrypted_api_key))
  connection.last_tested_at=timezone.now()
  if result['valid']:
   connection.status=AIProviderConnection.Status.ACTIVE
   connection.last_success_at=timezone.now()
   connection.last_error_message=''
  else:
   connection.status=AIProviderConnection.Status.INVALID
   connection.last_error_message=result.get('error','')
  connection.save(update_fields=['status','last_tested_at','last_success_at','last_error_message','updated_at'])
  return Response(result)


class DefaultProviderConnectionView(ProviderConnectionDetailView):
 def patch(self,request,connection_id):
  connection=self.connection(connection_id)
  if connection.status != AIProviderConnection.Status.ACTIVE:
   return Response({'detail':'Solo una conexión activa puede ser predeterminada.'},status=400)
  AIProviderConnection.objects.filter(workspace=connection.workspace).update(is_default=False)
  connection.is_default=True
  connection.save(update_fields=['is_default','updated_at'])
  return Response(AIProviderConnectionSerializer(connection).data)


class ProviderModelsView(ProviderConnectionDetailView):
 def get(self,request,connection_id):
  connection=self.connection(connection_id)
  if connection.status != AIProviderConnection.Status.ACTIVE or not connection.encrypted_api_key:
   return Response({'detail':'La conexión debe estar activa para consultar modelos.'},status=400)
  return Response({'items':available_provider_models(connection)})
