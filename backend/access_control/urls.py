from django.urls import path
from .views import MemberView, OverviewView, UserPolicyView, WorkspacePolicyView

urlpatterns = [
    path("overview/", OverviewView.as_view()),
    path("users/<uuid:user_id>/", UserPolicyView.as_view()),
    path("workspaces/<uuid:workspace_id>/", WorkspacePolicyView.as_view()),
    path("workspaces/<uuid:workspace_id>/members/<uuid:member_id>/", MemberView.as_view()),
]
