from math import gcd

from studio.models import FORMAT_SPECS


def ratio_string(width, height):
    if not width or not height:
        return FORMAT_SPECS["portrait"]["aspect_ratio"]
    divisor = gcd(int(width), int(height)) or 1
    return f"{int(width) // divisor}:{int(height) // divisor}"


def reference_dimensions(reference):
    image = getattr(reference, "image", None) or getattr(reference, "file", None)
    width = getattr(reference, "width", None)
    height = getattr(reference, "height", None)
    if width and height:
        return {"width": width, "height": height, "aspect_ratio": ratio_string(width, height)}
    if image:
        width = getattr(image, "width", None)
        height = getattr(image, "height", None)
        if width and height:
            return {"width": width, "height": height, "aspect_ratio": ratio_string(width, height)}
    return None


def resolve_job_dimensions(job):
    template = job.template or job.project.template
    if template and template.format in FORMAT_SPECS:
        return template.format, FORMAT_SPECS[template.format]

    template_input = (
        job.input_assets.select_related("brand_asset")
        .filter(input_role="template")
        .order_by("sort_order", "created_at")
        .first()
    )
    if template_input:
        dimensions = reference_dimensions(template_input.brand_asset)
        if dimensions:
            return "custom_template_asset", dimensions

    template_reference = (
        job.references.select_related("reference")
        .filter(input_role="template")
        .order_by("-weight")
        .first()
    )
    if template_reference:
        dimensions = reference_dimensions(template_reference.reference)
        if dimensions:
            return "custom_template_reference", dimensions

    return "portrait", FORMAT_SPECS["portrait"]


def resolve_job_parameters(job):
    format_code, specs = resolve_job_dimensions(job)
    current = job.parameters or {}
    return {
        "schema_version": 2,
        "model_code": current.get("model_code", ""),
        "format": format_code,
        "format_specs": specs,
        "aspect_ratio": current.get("aspect_ratio") or specs["aspect_ratio"],
        "resolution": current.get("resolution", "1K"),
        "quality_mode": current.get("quality_mode", "standard"),
        "output_format": current.get("output_format", "png"),
        "seed": current.get("seed"),
        "guidance_scale": current.get("guidance_scale"),
        "temperature": current.get("temperature"),
        "style_strength": current.get("style_strength"),
        "reference_strength": current.get("reference_strength"),
        "custom": current.get("custom", {}),
        "name": current.get("name") or job.name,
    }
