import mimetypes
from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class GenerationImageSource:
    """
    Representa una imagen adjunta a un GenerationJob en el orden exacto
    en que será enviada al proveedor.

    image_number es 1-based porque el prompt usa Image 1, Image 2, etc.
    """

    image_number: int
    source_type: str
    source_id: Any
    input_role: str
    purpose_codes: tuple[str, ...]
    name: str
    image_file: Any
    mime_type: str
    weight: int | None = None
    sort_order: int | None = None
    notes: str = ""
    category: str = ""


def _is_image_mime_type(mime_type: str) -> bool:
    return bool(mime_type and mime_type.startswith("image/"))


def ordered_generation_image_sources(job) -> list[GenerationImageSource]:
    """
    Devuelve las imágenes del job en el orden canónico:

    1. CreativeReference por weight descendente.
    2. BrandAsset por sort_order ascendente.

    Este orden debe reutilizarse en:
    - Etapa 1: brief builder.
    - Etapa 2: compositor Gemini.
    - Etapa 3: carga y envío a FAL.
    """

    unordered_sources: list[dict] = []

    references = (
        job.references.select_related("reference")
        .prefetch_related("purpose")
        .order_by("-weight", "id")
    )

    for item in references:
        image = item.reference.image

        if not image:
            continue

        mime_type = mimetypes.guess_type(image.name)[0] or "image/jpeg"

        if not _is_image_mime_type(mime_type):
            continue

        unordered_sources.append(
            {
                "source_type": "creative_reference",
                "source_id": item.id,
                "input_role": item.input_role,
                "purpose_codes": tuple(item.purpose.values_list("code", flat=True)),
                "name": item.reference.title,
                "image_file": image,
                "mime_type": mime_type,
                "weight": item.weight,
                "sort_order": None,
                "notes": item.reference.notes or "",
                "category": item.reference.category,
            }
        )

    input_assets = (
        job.input_assets.select_related("brand_asset")
        .prefetch_related("purpose")
        .order_by("sort_order", "id")
    )

    for item in input_assets:
        asset = item.brand_asset

        if not asset.file:
            continue

        mime_type = (
            asset.mime_type or mimetypes.guess_type(asset.file.name)[0] or "image/png"
        )

        if not _is_image_mime_type(mime_type):
            continue

        unordered_sources.append(
            {
                "source_type": "brand_asset",
                "source_id": item.id,
                "input_role": item.input_role,
                "purpose_codes": tuple(item.purpose.values_list("code", flat=True)),
                "name": asset.name,
                "image_file": asset.file,
                "mime_type": mime_type,
                "weight": None,
                "sort_order": item.sort_order,
                "notes": "",
                "category": asset.category,
            }
        )

    limit = 3 if job.model_name == "gemini-2.5-flash-image" else 10

    return [
        GenerationImageSource(
            image_number=index,
            **source,
        )
        for index, source in enumerate(
            unordered_sources[:limit],
            start=1,
        )
    ]
