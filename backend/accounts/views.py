from rest_framework import generics,permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView
from django.utils.text import slugify
from billing.models import Plan,Subscription
from .models import IndividualProfile,Workspace,WorkspaceMember
from .serializers import RegisterSerializer,EmailTokenSerializer,UserSerializer,WorkspaceSerializer
class RegisterView(generics.CreateAPIView): serializer_class=RegisterSerializer; permission_classes=[permissions.AllowAny]
class LoginView(TokenObtainPairView): serializer_class=EmailTokenSerializer; permission_classes=[permissions.AllowAny]
class MeView(APIView):
 def get(self,request): return Response(UserSerializer(request.user).data)
class WorkspaceListView(generics.ListAPIView):
 serializer_class=WorkspaceSerializer
 def get_queryset(self):
  qs=Workspace.objects.filter(memberships__user=self.request.user,memberships__is_active=True).distinct()
  if qs.exists(): return qs
  base=slugify(self.request.user.email.split('@')[0]) or 'workspace'; slug=base; i=1
  while Workspace.objects.filter(slug=slug).exists(): i+=1; slug=f'{base}-{i}'
  ws=Workspace.objects.create(name=f'Estudio de {self.request.user.email}',slug=slug,workspace_type='individual',owner=self.request.user)
  WorkspaceMember.objects.create(workspace=ws,user=self.request.user,role='owner')
  IndividualProfile.objects.get_or_create(workspace=ws,defaults={'business_name':ws.name})
  plan,_=Plan.objects.get_or_create(name='Starter',defaults={'monthly_price':19,'max_members':1})
  Subscription.objects.get_or_create(workspace=ws,defaults={'plan':plan,'status':'trialing'})
  return Workspace.objects.filter(id=ws.id)
