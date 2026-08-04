from datetime import timedelta

from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from accounts.models import PlatformAdmin, User, Workspace, WorkspaceMember
from billing.models import Plan, Subscription
from .models import UserAccessPolicy, WorkspaceAccessPolicy
from .services import can_add_member, evaluate_workspace_access, get_seat_limit


class AccessControlTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user("member@example.com", "test-pass-123", status="active")
        self.admin = User.objects.create_superuser("admin@example.com", "test-pass-123")
        self.workspace = Workspace.objects.create(name="Acme", slug="acme", workspace_type="company", owner=self.user)
        self.member = WorkspaceMember.objects.create(workspace=self.workspace, user=self.user, role="owner")
        self.plan = Plan.objects.create(name="Team", monthly_price=30, max_members=1)
        self.subscription = Subscription.objects.create(workspace=self.workspace, plan=self.plan, status="active")

    def decision(self):
        return evaluate_workspace_access(self.user, self.workspace)

    def test_user_blocked_over_paid_workspace(self):
        UserAccessPolicy.objects.create(user=self.user, mode="blocked")
        self.assertFalse(self.decision()["allowed"])

    def test_workspace_blocked_with_active_user(self):
        WorkspaceAccessPolicy.objects.create(workspace=self.workspace, mode="blocked")
        self.assertFalse(self.decision()["allowed"])

    def test_free_user_access(self):
        self.subscription.status = "cancelled"; self.subscription.save()
        UserAccessPolicy.objects.create(user=self.user, mode="free")
        self.assertTrue(self.decision()["allowed"])

    def test_free_workspace_access(self):
        self.subscription.status = "cancelled"; self.subscription.save()
        WorkspaceAccessPolicy.objects.create(workspace=self.workspace, mode="free")
        self.assertTrue(self.decision()["allowed"])

    def test_active_subscription(self):
        self.assertTrue(self.decision()["allowed"])

    def test_inactive_subscription_without_override(self):
        self.subscription.status = "cancelled"; self.subscription.save()
        self.assertFalse(self.decision()["allowed"])

    def test_expired_free_policy(self):
        self.subscription.status = "cancelled"; self.subscription.save()
        UserAccessPolicy.objects.create(user=self.user, mode="free", expires_at=timezone.now() - timedelta(seconds=1))
        self.assertFalse(self.decision()["allowed"])

    def test_seat_limit(self):
        self.assertEqual(get_seat_limit(self.workspace), 1)
        self.assertFalse(can_add_member(self.workspace))
        WorkspaceAccessPolicy.objects.create(workspace=self.workspace, seat_limit_override=3)
        self.assertEqual(get_seat_limit(self.workspace), 3)

    def test_reactivate_member_without_seats(self):
        other = User.objects.create_user("other@example.com", "test-pass-123", status="active")
        suspended = WorkspaceMember.objects.create(workspace=self.workspace, user=other, is_active=False)
        self.client.force_authenticate(self.admin)
        response = self.client.patch(f"/api/admin/access-control/workspaces/{self.workspace.id}/members/{suspended.id}/", {"is_active": True}, format="json")
        self.assertEqual(response.status_code, 400)

    def test_normal_user_rejected_from_admin_api(self):
        self.client.force_authenticate(self.user)
        self.assertEqual(self.client.get("/api/admin/access-control/overview/").status_code, 403)

    def test_platform_admin_authorized(self):
        platform_user = User.objects.create_user("support@example.com", "test-pass-123", status="active")
        PlatformAdmin.objects.create(user=platform_user, role="support_admin", is_active=True)
        self.client.force_authenticate(platform_user)
        self.assertEqual(self.client.get("/api/admin/access-control/overview/").status_code, 200)

    def test_cannot_suspend_only_active_owner(self):
        self.client.force_authenticate(self.admin)
        response = self.client.patch(f"/api/admin/access-control/workspaces/{self.workspace.id}/members/{self.member.id}/", {"is_active": False}, format="json")
        self.assertEqual(response.status_code, 400)
