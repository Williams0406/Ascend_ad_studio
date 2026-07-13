from rest_framework.permissions import BasePermission
from accounts.models import WorkspaceMember
class WorkspaceAccess(BasePermission):
 def has_permission(self,request,view):
  wid=request.headers.get('X-Workspace-ID') or request.query_params.get('workspace_id')
  if not wid: return False
  return WorkspaceMember.objects.filter(workspace_id=wid,user=request.user,is_active=True).exists()
