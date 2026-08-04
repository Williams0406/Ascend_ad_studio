import base64
import mimetypes
from io import BytesIO

import requests
from django.core.files.base import ContentFile
from django.utils import timezone

from integrations.services.encryption import decrypt_api_key
from studio.models import GeneratedAsset


class GenerationProviderError(Exception):
    pass


GEMINI_RESPONSE_ASPECT_RATIOS = {
    "1:1": "ASPECT_RATIO_ONE_BY_ONE",
    "1:4": "ASPECT_RATIO_ONE_BY_FOUR",
    "1:8": "ASPECT_RATIO_ONE_BY_EIGHT",
    "2:3": "ASPECT_RATIO_TWO_BY_THREE",
    "3:2": "ASPECT_RATIO_THREE_BY_TWO",
    "3:4": "ASPECT_RATIO_THREE_BY_FOUR",
    "4:1": "ASPECT_RATIO_FOUR_BY_ONE",
    "4:3": "ASPECT_RATIO_FOUR_BY_THREE",
    "4:5": "ASPECT_RATIO_FOUR_BY_FIVE",
    "5:4": "ASPECT_RATIO_FIVE_BY_FOUR",
    "8:1": "ASPECT_RATIO_EIGHT_BY_ONE",
    "9:16": "ASPECT_RATIO_NINE_BY_SIXTEEN",
    "16:9": "ASPECT_RATIO_SIXTEEN_BY_NINE",
    "21:9": "ASPECT_RATIO_TWENTY_ONE_BY_NINE",
}


def gemini_response_aspect_ratio(value):
    normalized = (value or "4:5").strip()
    try:
        return GEMINI_RESPONSE_ASPECT_RATIOS[normalized]
    except KeyError as exc:
        supported = ", ".join(GEMINI_RESPONSE_ASPECT_RATIOS)
        raise GenerationProviderError(
            f'La proporción "{normalized}" no es compatible con Gemini. '
            f"Usa una de estas opciones: {supported}."
        ) from exc


def complete_generation(job, outputs):
    job.status = "completed"
    job.completed_at = timezone.now()
    job.save(update_fields=["status", "completed_at"])
    if not job.batch_id:
        job.project.status = "completed"
        job.project.save(update_fields=["status"])
    return outputs


class GeminiGenerationProvider:
    endpoint = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"

    def __init__(self, connection, timeout=120):
        self.api_key = decrypt_api_key(connection.encrypted_api_key)
        self.timeout = timeout

    def _reference_parts(self, job):
        parts = []
        sources = [
            (
                item.reference.image,
                mimetypes.guess_type(item.reference.image.name)[0] or "image/jpeg",
            )
            for item in job.references.select_related("reference").order_by("-weight")
            if item.reference.image
        ]
        sources.extend(
            (item.brand_asset.file, item.brand_asset.mime_type or "image/png")
            for item in job.input_assets.select_related("brand_asset").order_by("sort_order")
            if item.brand_asset.file and (item.brand_asset.mime_type or "").startswith("image/")
        )
        limit = 3 if job.model_name == "gemini-2.5-flash-image" else 10
        for image_file, mime_type in sources[:limit]:
            if not image_file:
                continue
            try:
                with image_file.open("rb") as source:
                    encoded = base64.b64encode(source.read()).decode("ascii")
                parts.append(
                    {
                        "inlineData": {
                            "mimeType": mime_type,
                            "data": encoded,
                        }
                    }
                )
            except OSError:
                continue
        return parts

    def _request_image(self, job):
        payload = {
            "contents": [
                {
                    "role": "user",
                    "parts": [{"text": job.prompt}, *self._reference_parts(job)],
                }
            ],
            "generationConfig": {
                "responseModalities": ["IMAGE"],
                "responseFormat": {
                    "image": {
                        "aspectRatio": gemini_response_aspect_ratio(
                            job.parameters.get("aspect_ratio", "4:5")
                        )
                    }
                },
            },
        }
        response = requests.post(
            self.endpoint.format(model=job.model_name),
            headers={"x-goog-api-key": self.api_key, "Content-Type": "application/json"},
            json=payload,
            timeout=self.timeout,
        )
        if response.status_code == 401:
            raise GenerationProviderError("Gemini rechazó la API key configurada.")
        if response.status_code == 403:
            raise GenerationProviderError("La API key no tiene permiso para generar imágenes con Gemini.")
        if response.status_code == 429:
            raise GenerationProviderError("Gemini alcanzó su límite de cuota. Revisa la facturación o inténtalo más tarde.")
        if not response.ok:
            try:
                detail = response.json().get("error", {}).get("message", "")
            except (TypeError, ValueError):
                detail = ""
            raise GenerationProviderError(detail or f"Gemini devolvió el estado {response.status_code}.")

        data = response.json()
        candidates = data.get("candidates") or []
        if not candidates:
            block_reason = (data.get("promptFeedback") or {}).get("blockReason")
            message = "Gemini no devolvió una imagen."
            if block_reason:
                message += f" Motivo de seguridad: {block_reason}."
            raise GenerationProviderError(message)
        for part in candidates[0].get("content", {}).get("parts", []):
            inline = part.get("inlineData") or part.get("inline_data")
            if inline and inline.get("data"):
                return base64.b64decode(inline["data"]), inline.get("mimeType") or inline.get("mime_type") or "image/png"
        raise GenerationProviderError("Gemini respondió correctamente, pero no incluyó datos de imagen.")

    def generate(self, job):
        from PIL import Image

        outputs = []
        for index in range(job.number_of_outputs):
            image_bytes, mime_type = self._request_image(job)
            try:
                with Image.open(BytesIO(image_bytes)) as image:
                    width, height = image.size
                    output_format = (image.format or "PNG").lower()
            except OSError as exc:
                raise GenerationProviderError("Gemini devolvió un archivo de imagen inválido.") from exc
            extension = "jpg" if output_format == "jpeg" else output_format
            asset = GeneratedAsset(
                job=job,
                project=job.project,
                mime_type=mime_type,
                width=width,
                height=height,
                file_size=len(image_bytes),
                prompt_used=job.prompt,
                metadata={
                    "schema_version": 1,
                    "provider": "gemini",
                    "model": job.model_name,
                    "variation": index + 1,
                    "generation": {
                        "aspect_ratio": job.parameters.get("aspect_ratio", "4:5"),
                        "resolution": job.parameters.get("resolution", "1K"),
                    },
                },
            )
            asset.file.save(
                f"{job.project_id}-{job.id}-{index + 1}.{extension}",
                ContentFile(image_bytes),
                save=True,
            )
            outputs.append(asset)
        return complete_generation(job, outputs)


class MockGenerationProvider:
    def generate(self, job):
        from PIL import Image, ImageDraw

        outputs = []
        for index in range(job.number_of_outputs):
            image = Image.new("RGB", (1080, 1350), (245, 245, 245))
            draw = ImageDraw.Draw(image)
            draw.rounded_rectangle((70, 70, 1010, 1280), radius=35, outline=(40, 40, 40), width=4)
            draw.text((120, 130), job.headline or job.project.headline or job.name or job.project.name, fill=(20, 20, 20))
            draw.text((120, 240), job.offer_text or job.project.offer_text or "Contenido publicitario generado", fill=(60, 60, 60))
            draw.text((120, 1120), job.call_to_action or job.project.call_to_action or "Compra ahora", fill=(20, 20, 20))
            draw.text((120, 1210), f"Variación {index + 1} · {job.parameters.get('aspect_ratio', '4:5')}", fill=(110, 110, 110))
            buffer = BytesIO()
            image.save(buffer, format="PNG")
            image_bytes = buffer.getvalue()
            asset = GeneratedAsset(
                job=job,
                project=job.project,
                mime_type="image/png",
                width=1080,
                height=1350,
                file_size=len(image_bytes),
                prompt_used=job.prompt,
                metadata={
                    "schema_version": 1,
                    "provider": "mock",
                    "requested_provider": job.provider,
                    "model": job.model_name,
                    "variation": index + 1,
                },
            )
            asset.file.save(
                f"{job.project_id}-{job.id}-{index + 1}.png",
                ContentFile(image_bytes),
                save=True,
            )
            outputs.append(asset)
        return complete_generation(job, outputs)
