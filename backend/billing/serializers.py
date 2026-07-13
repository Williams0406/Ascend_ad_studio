from rest_framework import serializers
from .models import Plan,Subscription,CreditBalance
class PlanSerializer(serializers.ModelSerializer):
 class Meta: model=Plan; fields='__all__'
class SubscriptionSerializer(serializers.ModelSerializer):
 plan=PlanSerializer(read_only=True)
 class Meta: model=Subscription; fields='__all__'
class CreditBalanceSerializer(serializers.ModelSerializer):
 class Meta: model=CreditBalance; fields=['available_credits','reserved_credits','updated_at']
