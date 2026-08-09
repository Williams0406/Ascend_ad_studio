import base64
from io import BytesIO

import fal_client
import requests
from django.conf import settings
from django.core.files.base import ContentFile
from django.db import transaction
from django.utils import timezone

from integrations.services.encryption import decrypt_api_key
from studio.models import GeneratedAsset
from studio.services.generation_inputs import (
    ordered_generation_image_sources,
)


class GenerationProviderError(Exception):
    pass


FAL_NANO_BANANA_PRO_EDIT_MODEL = "fal-ai/nano-banana-pro/edit"

FAL_SUPPORTED_ASPECT_RATIOS = {
    "auto",
    "21:9",
    "16:9",
    "3:2",
    "4:3",
    "5:4",
    "1:1",
    "4:5",
    "3:4",
    "2:3",
    "9:16",
}

FAL_SUPPORTED_RESOLUTIONS = {
    "1K",
    "2K",
    "4K",
}

FAL_SUPPORTED_OUTPUT_FORMATS = {
    "png",
    "jpeg",
    "webp",
}

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


def effective_generation_prompt(job):
    """
    Usa el prompt de la Etapa 2 cuando existe.

    El fallback a job.prompt mantiene compatibilidad durante
    la transición al pipeline de tres etapas.
    """

    composed_prompt = str(job.composed_prompt or "").strip()

    if composed_prompt:
        return composed_prompt

    return str(job.prompt or "").strip()


def fal_aspect_ratio(value):
    normalized = str(value or "auto").strip()

    if normalized in FAL_SUPPORTED_ASPECT_RATIOS:
        return normalized

    aliases = {
        "1.91:1": "16:9",
        "1.414:1": "3:2",
        "10:3": "3:1",
        "12:5": "21:9",
    }

    mapped = aliases.get(normalized)

    if mapped in FAL_SUPPORTED_ASPECT_RATIOS:
        return mapped

    return "auto"


def fal_resolution(value):
    normalized = str(value or "1K").strip().upper()

    if normalized in FAL_SUPPORTED_RESOLUTIONS:
        return normalized

    return "1K"


def fal_output_format(value):
    normalized = str(value or "png").strip().lower()

    if normalized == "jpg":
        normalized = "jpeg"

    if normalized in FAL_SUPPORTED_OUTPUT_FORMATS:
        return normalized

    return "png"


def _file_name_from_source(source):
    name = getattr(
        source.image_file,
        "name",
        "",
    )

    if name:
        return name.rsplit("/", 1)[-1]

    extension = source.mime_type.split("/", 1)[-1] if "/" in source.mime_type else "png"

    return f"image-{source.image_number}.{extension}"


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

        for source in ordered_generation_image_sources(job):
            try:
                with source.image_file.open("rb") as image_file:
                    encoded = base64.b64encode(image_file.read()).decode("ascii")

                parts.append(
                    {
                        "inlineData": {
                            "mimeType": source.mime_type,
                            "data": encoded,
                        }
                    }
                )
            except OSError:
                continue

        return parts

    def _request_image(self, job):
        prompt = effective_generation_prompt(job)

        if not prompt:
            raise GenerationProviderError(
                "El job no contiene un prompt para generar la imagen."
            )

        payload = {
            "contents": [
                {
                    "role": "user",
                    "parts": [
                        {
                            "text": prompt,
                        },
                        *self._reference_parts(job),
                    ],
                }
            ],
            "generationConfig": {
                "responseModalities": ["IMAGE"],
                "responseFormat": {
                    "image": {
                        "aspectRatio": gemini_response_aspect_ratio(
                            job.parameters.get(
                                "aspect_ratio",
                                "4:5",
                            )
                        )
                    }
                },
            },
        }

        response = requests.post(
            self.endpoint.format(model=job.model_name),
            headers={
                "x-goog-api-key": self.api_key,
                "Content-Type": "application/json",
            },
            json=payload,
            timeout=self.timeout,
        )

        if response.status_code == 401:
            raise GenerationProviderError("Gemini rechazó la API key configurada.")

        if response.status_code == 403:
            raise GenerationProviderError(
                "La API key no tiene permiso para generar " "imágenes con Gemini."
            )

        if response.status_code == 429:
            raise GenerationProviderError(
                "Gemini alcanzó su límite de cuota. "
                "Revisa la facturación o inténtalo más tarde."
            )

        if not response.ok:
            try:
                detail = response.json().get("error", {}).get("message", "")
            except (TypeError, ValueError):
                detail = ""

            raise GenerationProviderError(
                detail or (f"Gemini devolvió el estado " f"{response.status_code}.")
            )

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
                return (
                    base64.b64decode(inline["data"]),
                    inline.get("mimeType") or inline.get("mime_type") or "image/png",
                )

        raise GenerationProviderError(
            "Gemini respondió correctamente, pero no " "incluyó datos de imagen."
        )

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
                raise GenerationProviderError(
                    "Gemini devolvió un archivo de imagen inválido."
                ) from exc
            extension = "jpg" if output_format == "jpeg" else output_format
            asset = GeneratedAsset(
                job=job,
                project=job.project,
                mime_type=mime_type,
                width=width,
                height=height,
                file_size=len(image_bytes),
                prompt_used=effective_generation_prompt(job),
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


class FalGenerationProvider:
    """
    Etapa 3 del pipeline.

    Recibe exclusivamente el prompt compuesto por Gemini
    y las imágenes del GenerationJob en el mismo orden
    utilizado por las Etapas 1 y 2.
    """

    model_name = FAL_NANO_BANANA_PRO_EDIT_MODEL

    def __init__(
        self,
        connection,
        *,
        timeout=None,
    ):
        if connection is None:
            raise GenerationProviderError(
                "El job no tiene una conexión fal.ai configurada."
            )

        if connection.provider != "fal":
            raise GenerationProviderError(
                "FalGenerationProvider requiere una conexión fal.ai."
            )

        if connection.status != "active":
            raise GenerationProviderError("La conexión fal.ai no está activa.")

        if not connection.encrypted_api_key:
            raise GenerationProviderError(
                "La conexión fal.ai no contiene una API key activa."
            )

        self.connection = connection

        self.api_key = decrypt_api_key(connection.encrypted_api_key)

        self.timeout = (
            timeout if timeout is not None else settings.FAL_GENERATION_TIMEOUT
        )

        self.client = fal_client.SyncClient(
            key=self.api_key,
            default_timeout=float(settings.FAL_UPLOAD_TIMEOUT),
        )

    def _upload_source(self, source):
        """
        Sube una imagen a fal CDN y devuelve su URL pública.
        """

        try:
            with source.image_file.open("rb") as image_file:
                image_bytes = image_file.read()
        except OSError as exc:
            raise GenerationProviderError(
                f"No se pudo leer Image " f"{source.image_number}: " f"{source.name}."
            ) from exc

        if not image_bytes:
            raise GenerationProviderError(f"Image {source.image_number} está vacía.")

        try:
            return self.client.upload(
                image_bytes,
                source.mime_type,
                file_name=_file_name_from_source(source),
            )
        except Exception as exc:
            raise GenerationProviderError(
                f"No se pudo subir Image " f"{source.image_number} a fal.ai."
            ) from exc

    def _image_urls(self, job):
        """
        Mantiene exactamente el mismo orden canónico
        usado por el brief y el compositor Gemini.
        """

        sources = ordered_generation_image_sources(job)

        if not sources:
            raise GenerationProviderError(
                "nano-banana-pro/edit requiere " "al menos una imagen de entrada."
            )

        urls = []

        for source in sources:
            url = self._upload_source(source)

            if not url:
                raise GenerationProviderError(
                    f"fal.ai no devolvió URL pública "
                    f"para Image {source.image_number}."
                )

            urls.append(url)

        return urls

    def _build_arguments(
        self,
        job,
        image_urls,
    ):
        composed_prompt = str(job.composed_prompt or "").strip()

        if not composed_prompt:
            raise GenerationProviderError(
                "El job no contiene composed_prompt. "
                "La Etapa 2 debe completarse antes "
                "de generar con FAL."
            )

        parameters = job.parameters or {}

        arguments = {
            "prompt": composed_prompt,
            "image_urls": image_urls,
            "num_images": job.number_of_outputs,
            "aspect_ratio": fal_aspect_ratio(
                parameters.get(
                    "aspect_ratio",
                    "auto",
                )
            ),
            "resolution": fal_resolution(
                parameters.get(
                    "resolution",
                    "1K",
                )
            ),
            "output_format": fal_output_format(
                parameters.get(
                    "output_format",
                    "png",
                )
            ),
            "safety_tolerance": str(settings.FAL_SAFETY_TOLERANCE),
            "limit_generations": True,
        }

        seed = parameters.get("seed")

        if seed is not None:
            arguments["seed"] = int(seed)

        return arguments

    def _fal_headers(self):
        headers = {}

        if not settings.FAL_STORE_IO:
            headers["X-Fal-Store-IO"] = "0"

        return headers

    def _subscribe(
        self,
        job,
        arguments,
    ):
        request_id_holder = {
            "value": "",
        }

        def on_enqueue(request_id):
            request_id_holder["value"] = str(request_id or "")

            if request_id:
                job.provider_request_id = str(request_id)

                job.save(
                    update_fields=[
                        "provider_request_id",
                        "updated_at",
                    ]
                )

        try:
            result = self.client.subscribe(
                self.model_name,
                arguments=arguments,
                with_logs=False,
                on_enqueue=on_enqueue,
                headers=self._fal_headers(),
                client_timeout=float(self.timeout),
            )
        except Exception as exc:
            raise GenerationProviderError(
                "fal.ai no pudo completar la " "generación con Nano Banana Pro."
            ) from exc

        if not job.provider_request_id and request_id_holder["value"]:
            job.provider_request_id = request_id_holder["value"]

            job.save(
                update_fields=[
                    "provider_request_id",
                    "updated_at",
                ]
            )

        if not isinstance(result, dict):
            raise GenerationProviderError("fal.ai devolvió una respuesta inválida.")

        return result

    def _download_output(
        self,
        image_data,
    ):
        url = str(image_data.get("url") or "").strip()

        if not url:
            raise GenerationProviderError("fal.ai devolvió una imagen " "sin URL.")

        try:
            response = requests.get(
                url,
                timeout=(settings.FAL_OUTPUT_DOWNLOAD_TIMEOUT),
            )
            response.raise_for_status()
        except requests.RequestException as exc:
            raise GenerationProviderError(
                "No se pudo descargar una imagen " "generada por fal.ai."
            ) from exc

        image_bytes = response.content

        if not image_bytes:
            raise GenerationProviderError("fal.ai devolvió un archivo vacío.")

        mime_type = (
            image_data.get("content_type")
            or response.headers.get(
                "Content-Type",
                "",
            )
            or "image/png"
        )

        return image_bytes, mime_type

    def generate(self, job):
        from PIL import Image

        if job.model_name != self.model_name:
            raise GenerationProviderError(
                f'El modelo "{job.model_name}" '
                "no es compatible con FalGenerationProvider."
            )

        composed_prompt = str(job.composed_prompt or "").strip()

        if not composed_prompt:
            raise GenerationProviderError(
                "FAL requiere job.composed_prompt. "
                "No se permite generar directamente "
                "desde job.prompt."
            )

        image_urls = self._image_urls(job)

        arguments = self._build_arguments(
            job,
            image_urls,
        )

        result = self._subscribe(
            job,
            arguments,
        )

        images = result.get("images") or []

        if not images:
            raise GenerationProviderError(
                "fal.ai respondió correctamente, " "pero no devolvió imágenes."
            )

        if len(images) != job.number_of_outputs:
            raise GenerationProviderError(
                "fal.ai devolvió una cantidad de imágenes "
                "distinta de la solicitada. "
                f"Solicitadas: {job.number_of_outputs}. "
                f"Recibidas: {len(images)}."
            )

        #
        # PRIMERA FASE
        # Descargar y validar TODOS los outputs.
        #
        prepared_outputs = []

        for index, image_data in enumerate(
            images,
            start=1,
        ):
            image_bytes, mime_type = self._download_output(image_data)

            try:
                with Image.open(BytesIO(image_bytes)) as image:
                    width, height = image.size
                    detected_format = (image.format or "PNG").lower()

            except OSError as exc:
                raise GenerationProviderError(
                    f"fal.ai devolvió un archivo inválido "
                    f"para la variación {index}."
                ) from exc

            extension = "jpg" if detected_format == "jpeg" else detected_format

            prepared_outputs.append(
                {
                    "index": index,
                    "image_bytes": image_bytes,
                    "mime_type": mime_type,
                    "width": width,
                    "height": height,
                    "extension": extension,
                }
            )

        #
        # SEGUNDA FASE
        # Persistir solamente cuando todos los outputs
        # anteriores han sido descargados y validados.
        #
        outputs = []

        with transaction.atomic():
            for prepared in prepared_outputs:
                index = prepared["index"]

                asset = GeneratedAsset(
                    job=job,
                    project=job.project,
                    mime_type=prepared["mime_type"],
                    width=prepared["width"],
                    height=prepared["height"],
                    file_size=len(prepared["image_bytes"]),
                    prompt_used=composed_prompt,
                    metadata={
                        "schema_version": 2,
                        "provider": "fal",
                        "model": self.model_name,
                        "variation": index,
                        "provider_request_id": (job.provider_request_id),
                        "generation": {
                            "aspect_ratio": (arguments["aspect_ratio"]),
                            "requested_aspect_ratio": (
                                job.parameters.get(
                                    "aspect_ratio",
                                    "auto",
                                )
                            ),
                            "resolution": (arguments["resolution"]),
                            "output_format": (arguments["output_format"]),
                            "input_image_count": len(image_urls),
                        },
                    },
                )

                asset.file.save(
                    (
                        f"{job.project_id}-"
                        f"{job.id}-"
                        f"{index}."
                        f"{prepared['extension']}"
                    ),
                    ContentFile(prepared["image_bytes"]),
                    save=True,
                )

                outputs.append(asset)

        return complete_generation(
            job,
            outputs,
        )


class MockGenerationProvider:
    def generate(self, job):
        from PIL import Image, ImageDraw

        outputs = []
        for index in range(job.number_of_outputs):
            image = Image.new("RGB", (1080, 1350), (245, 245, 245))
            draw = ImageDraw.Draw(image)
            draw.rounded_rectangle(
                (70, 70, 1010, 1280), radius=35, outline=(40, 40, 40), width=4
            )
            draw.text(
                (120, 130),
                job.headline or job.project.headline or job.name or job.project.name,
                fill=(20, 20, 20),
            )
            draw.text(
                (120, 240),
                job.offer_text
                or job.project.offer_text
                or "Contenido publicitario generado",
                fill=(60, 60, 60),
            )
            draw.text(
                (120, 1120),
                job.call_to_action or job.project.call_to_action or "Compra ahora",
                fill=(20, 20, 20),
            )
            draw.text(
                (120, 1210),
                f"Variación {index + 1} · {job.parameters.get('aspect_ratio', '4:5')}",
                fill=(110, 110, 110),
            )
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
                prompt_used=effective_generation_prompt(job),
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
