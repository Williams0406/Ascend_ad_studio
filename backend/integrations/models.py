import uuid
from django.conf import settings
from django.db import models


class AIProviderConnection(models.Model):
 class Provider(models.TextChoices):
  GEMINI='gemini','Gemini'
  FAL='fal','fal.ai'

 class Status(models.TextChoices):
  PENDING='pending','Pendiente'
  ACTIVE='active','Activa'
  INVALID='invalid','Inválida'
  REVOKED='revoked','Revocada'
  ERROR='error','Error'

 id=models.UUIDField(primary_key=True,default=uuid.uuid4,editable=False)
 workspace=models.ForeignKey('accounts.Workspace',on_delete=models.CASCADE,related_name='ai_connections')
 provider=models.CharField(max_length=20,choices=Provider.choices)
 encrypted_api_key=models.TextField(blank=True)
 api_key_last_four=models.CharField(max_length=4,blank=True)
 status=models.CharField(max_length=20,choices=Status.choices,default=Status.PENDING)
 is_default=models.BooleanField(default=False)
 created_by=models.ForeignKey(settings.AUTH_USER_MODEL,on_delete=models.PROTECT,related_name='created_ai_connections')
 last_tested_at=models.DateTimeField(null=True,blank=True)
 last_success_at=models.DateTimeField(null=True,blank=True)
 last_error_message=models.TextField(blank=True)
 created_at=models.DateTimeField(auto_now_add=True)
 updated_at=models.DateTimeField(auto_now=True)

 class Meta:
  constraints=[models.UniqueConstraint(fields=['workspace','provider'],name='unique_provider_per_workspace')]

 def __str__(self):
  return f'{self.workspace} · {self.provider}'
