from rest_framework import generics,permissions
from .models import Plan
from .serializers import PlanSerializer
class PlanListView(generics.ListAPIView): queryset=Plan.objects.filter(is_active=True); serializer_class=PlanSerializer; permission_classes=[permissions.AllowAny]
