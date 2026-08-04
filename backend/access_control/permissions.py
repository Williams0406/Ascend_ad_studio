from rest_framework.permissions import BasePermission
from accounts.models import PlatformAdmin, Workspace
from .services import evaluate_workspace_access


class IsPlatformAccessAdmin(BasePermission):
    message = "No tienes permisos para administrar el acceso a la plataforma."

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and (
            user.is_superuser or PlatformAdmin.objects.filter(
                user=user, is_active=True, role__in=("super_admin", "billing_admin", "support_admin")
            ).exists()
        ))


class HasWorkspacePlatformAccess(BasePermission):
    def has_permission(self, request, view):
        workspace_id = request.headers.get("X-Workspace-ID") or request.query_params.get("workspace_id")
        if not workspace_id:
            self.message = "Workspace requerido."
            return False
        try:
            workspace = Workspace.objects.select_related("access_policy").get(id=workspace_id)
        except (Workspace.DoesNotExist, ValueError):
            self.message = "Workspace no encontrado."
            return False
        decision = evaluate_workspace_access(request.user, workspace)
        request.access_workspace = workspace
        request.access_decision = decision
        self.message = decision["reason"]
        return decision["allowed"]
