import requests
from django.conf import settings


def _soft_validate(provider,api_key):
 if len(api_key.strip()) < 10:
  return {'valid':False,'error':'La API key parece demasiado corta.'}
 if provider == 'gemini' and not (api_key.startswith('AIza') or len(api_key) >= 20):
  return {'valid':False,'error':'La clave Gemini no tiene un formato esperado.'}
 if provider == 'fal' and len(api_key) < 20:
  return {'valid':False,'error':'La clave fal.ai no tiene un formato esperado.'}
 return {'valid':True,'error':''}


def validate_gemini_key(api_key):
 if not settings.ENABLE_PROVIDER_KEY_REMOTE_VALIDATION:
  return _soft_validate('gemini',api_key)
 try:
  from google import genai
  client=genai.Client(api_key=api_key)
  response=client.models.generate_content(model='gemini-2.5-flash',contents='Responde únicamente OK')
  return {'valid':bool(getattr(response,'text','')),'error':''}
 except Exception as exc:
  return {'valid':False,'error':'No se pudo validar Gemini. Revisa la clave y permisos.'}


def validate_fal_key(api_key):
 if not settings.ENABLE_PROVIDER_KEY_REMOTE_VALIDATION:
  return _soft_validate('fal',api_key)
 try:
  response=requests.get('https://api.fal.ai/v1/models',headers={'Authorization':f'Key {api_key}'},params={'limit':1},timeout=15)
  if response.status_code == 200: return {'valid':True,'error':''}
  if response.status_code == 401: return {'valid':False,'error':'La clave fal.ai no es válida.'}
  if response.status_code == 403: return {'valid':False,'error':'La clave fal.ai no tiene permisos suficientes.'}
  if response.status_code == 429: return {'valid':False,'error':'fal.ai respondió con límite de uso o cuota.'}
  return {'valid':False,'error':f'fal.ai devolvió estado {response.status_code}.'}
 except requests.RequestException:
  return {'valid':False,'error':'No se pudo conectar con fal.ai para validar la clave.'}


def validate_provider_key(provider,api_key):
 if provider == 'gemini': return validate_gemini_key(api_key)
 if provider == 'fal': return validate_fal_key(api_key)
 return {'valid':False,'error':'Proveedor no soportado.'}
