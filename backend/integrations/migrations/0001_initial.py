import uuid
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

 initial = True

 dependencies = [
  ('accounts','0001_initial'),
  migrations.swappable_dependency(settings.AUTH_USER_MODEL),
 ]

 operations = [
  migrations.CreateModel(
   name='AIProviderConnection',
   fields=[
    ('id',models.UUIDField(default=uuid.uuid4,editable=False,primary_key=True,serialize=False)),
    ('provider',models.CharField(choices=[('gemini','Gemini'),('fal','fal.ai')],max_length=20)),
    ('encrypted_api_key',models.TextField(blank=True)),
    ('api_key_last_four',models.CharField(blank=True,max_length=4)),
    ('status',models.CharField(choices=[('pending','Pendiente'),('active','Activa'),('invalid','Inválida'),('revoked','Revocada'),('error','Error')],default='pending',max_length=20)),
    ('is_default',models.BooleanField(default=False)),
    ('last_tested_at',models.DateTimeField(blank=True,null=True)),
    ('last_success_at',models.DateTimeField(blank=True,null=True)),
    ('last_error_message',models.TextField(blank=True)),
    ('created_at',models.DateTimeField(auto_now_add=True)),
    ('updated_at',models.DateTimeField(auto_now=True)),
    ('created_by',models.ForeignKey(on_delete=django.db.models.deletion.PROTECT,related_name='created_ai_connections',to=settings.AUTH_USER_MODEL)),
    ('workspace',models.ForeignKey(on_delete=django.db.models.deletion.CASCADE,related_name='ai_connections',to='accounts.workspace')),
   ],
  ),
  migrations.AddConstraint(
   model_name='aiproviderconnection',
   constraint=models.UniqueConstraint(fields=('workspace','provider'),name='unique_provider_per_workspace'),
  ),
 ]
