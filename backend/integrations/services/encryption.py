from cryptography.fernet import Fernet, InvalidToken
from django.conf import settings


class CredentialEncryptionError(Exception):
 pass


def _fernet():
 return Fernet(settings.API_KEY_ENCRYPTION_SECRET.encode())


def encrypt_api_key(api_key):
 if not api_key:
  raise CredentialEncryptionError('La API key está vacía.')
 return _fernet().encrypt(api_key.encode()).decode()


def decrypt_api_key(encrypted_value):
 try:
  return _fernet().decrypt(encrypted_value.encode()).decode()
 except InvalidToken as exc:
  raise CredentialEncryptionError('No se pudo descifrar la credencial.') from exc
