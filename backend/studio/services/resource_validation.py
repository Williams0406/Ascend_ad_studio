from rest_framework import serializers

ROLE_CATEGORY = {
    "product_image": "product",
    "background": "background",
    "lifestyle_reference": "lifestyle",
    "character_reference": "persona",
    "packaging": "packaging",
    "icon": "icon",
    "logo": "logo",
    "template": "template",
    "reference_ad": "reference_ad",
}

CREATIVE_REFERENCE_ONLY_BLOCKED_ROLES = {"product_image", "icon", "logo"}


def allowed_purpose_codes(role, context=None):
    mapping = {
        "background": {"background"},
        "lifestyle_reference": {"lifestyle"},
        "character_reference": {"persona", "pose", "mood"},
        "packaging": {"packaging"},
        "icon": {"icon"},
        "logo": {"logo"},
        "template": {"template"},
        "reference_ad": {"style", "composition", "lighting"},
    }
    allowed = set(mapping.get(role, set()))
    if role == "reference_ad" and context and not context.use_brand_kit:
        allowed |= {"color", "typography"}
    return allowed


def validate_purposes(role, purposes, context=None):
    allowed = allowed_purpose_codes(role, context)
    if not allowed or not purposes:
        return
    codes = {purpose.code for purpose in purposes}
    invalid = codes - allowed
    if invalid:
        raise serializers.ValidationError(
            {"purpose": f"Propósitos no permitidos para {role}: {sorted(invalid)}."}
        )


def validate_brand_asset_for_generation(job, asset, role, purposes=None):
    if not job or not asset or not role:
        return
    if asset.workspace_id != job.project.workspace_id:
        raise serializers.ValidationError("El recurso no pertenece al workspace activo.")
    expected_category = ROLE_CATEGORY.get(role)
    if expected_category and asset.category != expected_category:
        raise serializers.ValidationError(
            {"brand_asset": f"Para {role} se requiere category={expected_category}."}
        )
    if role == "product_image":
        product = job.product or job.project.product
        allowed_ids = set()
        if product:
            if product.main_image_asset_id:
                allowed_ids.add(product.main_image_asset_id)
            allowed_ids |= set(product.image_assets.values_list("id", flat=True))
            if asset.id not in allowed_ids:
                raise serializers.ValidationError(
                    {"brand_asset": "La imagen de producto debe pertenecer al producto seleccionado."}
                )
    if not job.use_brand_kit and asset.category not in {"reference_ad", "product"}:
        raise serializers.ValidationError(
            {"brand_asset": "Sin Brand Kit solo se permiten recursos reference_ad o imágenes de producto."}
        )
    validate_purposes(role, purposes or [], job)


def validate_reference_for_generation(job, reference, role, purposes=None):
    if not job or not reference or not role:
        return
    if role in CREATIVE_REFERENCE_ONLY_BLOCKED_ROLES:
        raise serializers.ValidationError({"input_role": f"{role} solo puede usar BrandAsset."})
    if reference.workspace_id != job.project.workspace_id:
        raise serializers.ValidationError("La referencia no pertenece al workspace activo.")
    expected_category = ROLE_CATEGORY.get(role)
    if expected_category and reference.category != expected_category:
        raise serializers.ValidationError(
            {"reference": f"Para {role} se requiere category={expected_category}."}
        )
    if not job.use_brand_kit and reference.category != "reference_ad":
        raise serializers.ValidationError(
            {"reference": "Sin Brand Kit solo se permiten CreativeReference reference_ad."}
        )
    validate_purposes(role, purposes or [], job)
