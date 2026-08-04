from django.conf import settings
from django.db import models


class PolicyMode(models.TextChoices):
    INHERIT = "inherit", "Heredar"
    FREE = "free", "Gratuito"
    BLOCKED = "blocked", "Bloqueado"


class UserAccessPolicy(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="access_policy")
    mode = models.CharField(max_length=12, choices=PolicyMode.choices, default=PolicyMode.INHERIT)
    expires_at = models.DateTimeField(null=True, blank=True)
    reason = models.TextField(blank=True)
    updated_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="updated_user_access_policies")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)


class WorkspaceAccessPolicy(models.Model):
    workspace = models.OneToOneField("accounts.Workspace", on_delete=models.CASCADE, related_name="access_policy")
    mode = models.CharField(max_length=12, choices=PolicyMode.choices, default=PolicyMode.INHERIT)
    seat_limit_override = models.PositiveIntegerField(null=True, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    reason = models.TextField(blank=True)
    updated_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="updated_workspace_access_policies")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)


class AccessAuditLog(models.Model):
    ACTIONS = [
        ("user_policy_updated", "Política de usuario actualizada"),
        ("workspace_policy_updated", "Política de workspace actualizada"),
        ("member_updated", "Miembro actualizado"),
    ]
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="access_audit_events")
    action = models.CharField(max_length=40, choices=ACTIONS, db_index=True)
    target_type = models.CharField(max_length=40, db_index=True)
    target_id = models.CharField(max_length=64, db_index=True)
    before = models.JSONField(default=dict)
    after = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["target_type", "target_id", "-created_at"])]
