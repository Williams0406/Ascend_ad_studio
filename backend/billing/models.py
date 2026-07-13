import uuid
from django.db import models
from django.conf import settings
from accounts.models import Workspace
class Plan(models.Model):
 id=models.UUIDField(primary_key=True,default=uuid.uuid4,editable=False); name=models.CharField(max_length=100,unique=True); monthly_price=models.DecimalField(max_digits=12,decimal_places=2,default=0); currency_code=models.CharField(max_length=3,default='USD'); monthly_credits=models.PositiveIntegerField(default=100); storage_limit_mb=models.PositiveIntegerField(default=1000); max_members=models.PositiveIntegerField(default=1); is_active=models.BooleanField(default=True)
class Subscription(models.Model):
 id=models.UUIDField(primary_key=True,default=uuid.uuid4,editable=False); workspace=models.OneToOneField(Workspace,on_delete=models.CASCADE,related_name='subscription'); plan=models.ForeignKey(Plan,on_delete=models.PROTECT); status=models.CharField(max_length=20,default='trialing'); member_limit_override=models.PositiveIntegerField(null=True,blank=True); credit_limit_override=models.PositiveIntegerField(null=True,blank=True); current_period_start=models.DateTimeField(null=True,blank=True); current_period_end=models.DateTimeField(null=True,blank=True)
class CreditBalance(models.Model):
 workspace=models.OneToOneField(Workspace,on_delete=models.CASCADE,related_name='credit_balance'); available_credits=models.IntegerField(default=0); reserved_credits=models.IntegerField(default=0); updated_at=models.DateTimeField(auto_now=True)
class CreditMovement(models.Model):
 id=models.UUIDField(primary_key=True,default=uuid.uuid4,editable=False); workspace=models.ForeignKey(Workspace,on_delete=models.CASCADE,related_name='credit_movements'); user=models.ForeignKey(settings.AUTH_USER_MODEL,on_delete=models.SET_NULL,null=True); movement_type=models.CharField(max_length=20); credits=models.IntegerField(); description=models.TextField(blank=True); created_at=models.DateTimeField(auto_now_add=True)
