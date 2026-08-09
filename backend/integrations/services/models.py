import requests

from .encryption import decrypt_api_key

GEMINI_IMAGE_MODELS = {
    "gemini-3.1-flash-lite-image": "Gemini 3.1 Flash Lite Image · rápido",
    "gemini-3.1-flash-image": "Gemini 3.1 Flash Image · recomendado",
    "gemini-3-pro-image": "Gemini 3 Pro Image · máxima calidad",
    "gemini-2.5-flash-image": "Gemini 2.5 Flash Image · legado",
}

FAL_IMAGE_MODELS = {
    "nano-banana-pro-edit": ("Nano Banana Pro Edit · producción"),
}


def available_provider_models(connection, timeout=12):
    if connection.provider == "fal":
        return [
            {"code": code, "label": label} for code, label in FAL_IMAGE_MODELS.items()
        ]

    api_key = decrypt_api_key(connection.encrypted_api_key)
    try:
        response = requests.get(
            "https://generativelanguage.googleapis.com/v1beta/models",
            headers={"x-goog-api-key": api_key},
            timeout=timeout,
        )
        response.raise_for_status()
        accessible = {
            item.get("name", "").removeprefix("models/")
            for item in response.json().get("models", [])
            if "generateContent" in item.get("supportedGenerationMethods", [])
        }
        models = [
            {"code": code, "label": label}
            for code, label in GEMINI_IMAGE_MODELS.items()
            if code in accessible
        ]
        if models:
            return models
    except (requests.RequestException, TypeError, ValueError):
        pass

    return [
        {
            "code": "gemini-2.5-flash-image",
            "label": GEMINI_IMAGE_MODELS["gemini-2.5-flash-image"],
        }
    ]
