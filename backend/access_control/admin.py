from django.contrib import admin
from .models import AccessAuditLog, UserAccessPolicy, WorkspaceAccessPolicy


@admin.register(UserAccessPolicy)
class UserAccessPolicyAdmin(admin.ModelAdmin):
    list_display = ("user", "mode", "expires_at", "updated_by", "updated_at")
    search_fields = ("user__email", "reason")
    list_filter = ("mode",)


@admin.register(WorkspaceAccessPolicy)
class WorkspaceAccessPolicyAdmin(admin.ModelAdmin):
    list_display = ("workspace", "mode", "seat_limit_override", "expires_at", "updated_by")
    search_fields = ("workspace__name", "workspace__slug", "reason")
    list_filter = ("mode",)


@admin.register(AccessAuditLog)
class AccessAuditLogAdmin(admin.ModelAdmin):
    list_display = ("action", "target_type", "target_id", "actor", "created_at")
    readonly_fields = ("actor", "action", "target_type", "target_id", "before", "after", "created_at")
