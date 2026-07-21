import requests
from django.conf import settings


GEMINI_IMAGE_MODEL = "gemini-2.5-flash-image"


def _soft_validate(provider, api_key):
    value = api_key.strip()
    if len(value) < 10:
        return {"valid": False, "error": "La API key parece demasiado corta."}
    if provider == "gemini" and not (value.startswith("AIza") or len(value) >= 20):
        return {"valid": False, "error": "La clave Gemini no tiene un formato esperado."}
    if provider == "fal" and len(value) < 20:
        return {"valid": False, "error": "La clave fal.ai no tiene un formato esperado."}
    return {"valid": True, "error": ""}


def validate_gemini_key(api_key):
    format_result = _soft_validate("gemini", api_key)
    if not format_result["valid"] or not settings.ENABLE_PROVIDER_KEY_REMOTE_VALIDATION:
        return format_result

    try:
        response = requests.get(
            f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_IMAGE_MODEL}",
            headers={"x-goog-api-key": api_key},
            timeout=15,
        )
    except requests.RequestException:
        return {
            "valid": False,
            "error": "No se pudo contactar Gemini para validar la clave. Revisa la conexión del servidor.",
        }

    if response.status_code == 200:
        return {"valid": True, "error": "", "model": GEMINI_IMAGE_MODEL}
    if response.status_code == 400:
        return {"valid": False, "error": "Gemini rechazó el formato de la API key."}
    if response.status_code == 401:
        return {"valid": False, "error": "La API key de Gemini no es válida."}
    if response.status_code == 403:
        return {
            "valid": False,
            "error": "La clave no tiene acceso a Gemini API o el proyecto de Google requiere habilitar la API/facturación.",
        }
    if response.status_code == 404:
        return {
            "valid": False,
            "error": f"La clave es reconocida, pero no tiene disponible el modelo de imagen {GEMINI_IMAGE_MODEL}.",
        }
    if response.status_code == 429:
        return {"valid": False, "error": "Gemini respondió con límite de cuota o facturación."}
    return {"valid": False, "error": f"Gemini devolvió el estado {response.status_code} durante la validación."}


def validate_fal_key(api_key):
    format_result = _soft_validate("fal", api_key)
    if not format_result["valid"] or not settings.ENABLE_PROVIDER_KEY_REMOTE_VALIDATION:
        return format_result
    try:
        response = requests.get(
            "https://api.fal.ai/v1/models",
            headers={"Authorization": f"Key {api_key}"},
            params={"limit": 1},
            timeout=15,
        )
    except requests.RequestException:
        return {"valid": False, "error": "No se pudo conectar con fal.ai para validar la clave."}
    if response.status_code == 200:
        return {"valid": True, "error": ""}
    if response.status_code == 401:
        return {"valid": False, "error": "La clave fal.ai no es válida."}
    if response.status_code == 403:
        return {"valid": False, "error": "La clave fal.ai no tiene permisos suficientes."}
    if response.status_code == 429:
        return {"valid": False, "error": "fal.ai respondió con límite de uso o cuota."}
    return {"valid": False, "error": f"fal.ai devolvió estado {response.status_code}."}


def validate_provider_key(provider, api_key):
    if provider == "gemini":
        return validate_gemini_key(api_key)
    if provider == "fal":
        return validate_fal_key(api_key)
    return {"valid": False, "error": "Proveedor no soportado."}
