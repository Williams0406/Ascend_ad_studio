from rest_framework import generics,permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.exceptions import PermissionDenied
from accounts.models import WorkspaceMember
from .models import Plan,CreditBalance
from .serializers import PlanSerializer,CreditBalanceSerializer
class PlanListView(generics.ListAPIView): queryset=Plan.objects.filter(is_active=True); serializer_class=PlanSerializer; permission_classes=[permissions.AllowAny]
class CreditBalanceView(APIView):
 def get(self,request):
  wid=request.headers.get('X-Workspace-ID');
  if not wid: raise PermissionDenied('Workspace requerido.')
  if not WorkspaceMember.objects.filter(workspace_id=wid,user=request.user,is_active=True).exists(): return Response({'detail':'Sin acceso'},status=403)
  balance,_=CreditBalance.objects.get_or_create(workspace_id=wid,defaults={'available_credits':100}); return Response(CreditBalanceSerializer(balance).data)
