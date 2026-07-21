from django.utils import timezone
from rest_framework import serializers
from .models import AIProviderConnection
from .services.encryption import encrypt_api_key
from .services.validation import validate_provider_key


class AIProviderConnectionSerializer(serializers.ModelSerializer):
 class Meta:
  model=AIProviderConnection
  fields=['id','provider','api_key_last_four','status','is_default','last_tested_at','last_success_at','last_error_message','created_at','updated_at']


class ConnectAIProviderSerializer(serializers.Serializer):
 provider=serializers.ChoiceField(choices=AIProviderConnection.Provider.choices)
 api_key=serializers.CharField(write_only=True,trim_whitespace=True,min_length=10)
 is_default=serializers.BooleanField(default=False)

 def validate(self,attrs):
  result=validate_provider_key(attrs['provider'],attrs['api_key'])
  if not result['valid']:
   raise serializers.ValidationError({'api_key':result.get('error') or 'No se pudo validar la API key.'})
  attrs['_validation_result']=result
  return attrs

 def create(self,validated_data):
  request=self.context['request']; workspace=self.context['workspace']
  provider=validated_data['provider']; api_key=validated_data['api_key']
  result=validated_data.pop('_validation_result')
  if validated_data['is_default']:
   AIProviderConnection.objects.filter(workspace=workspace).update(is_default=False)
  connection,_=AIProviderConnection.objects.update_or_create(
   workspace=workspace,
   provider=provider,
   defaults={
    'encrypted_api_key':encrypt_api_key(api_key),
    'api_key_last_four':api_key[-4:],
    'status':AIProviderConnection.Status.ACTIVE if result['valid'] else AIProviderConnection.Status.INVALID,
    'is_default':validated_data['is_default'],
    'created_by':request.user,
    'last_tested_at':timezone.now(),
    'last_success_at':timezone.now() if result['valid'] else None,
    'last_error_message':result.get('error',''),
   }
  )
  if not AIProviderConnection.objects.filter(workspace=workspace,is_default=True,status=AIProviderConnection.Status.ACTIVE).exists() and connection.status == AIProviderConnection.Status.ACTIVE:
   connection.is_default=True; connection.save(update_fields=['is_default','updated_at'])
  return connection
