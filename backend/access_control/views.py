import json

from django.core.serializers.json import DjangoJSONEncoder
from django.db import transaction
from django.db.models import Count, Prefetch, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import PersonProfile, User, Workspace, WorkspaceMember
from billing.models import Subscription
from .models import AccessAuditLog, UserAccessPolicy, WorkspaceAccessPolicy
from .permissions import IsPlatformAccessAdmin
from .serializers import MemberUpdateSerializer, UserPolicyUpdateSerializer, WorkspacePolicyUpdateSerializer
from .services import can_add_member, evaluate_workspace_access, get_active_seat_count, get_seat_limit, get_subscription, seat_limit_error


def profile_name(user):
    profile = getattr(user, "profile", None)
    return " ".join(filter(None, [getattr(profile, "first_name", ""), getattr(profile, "last_name", "")])) or user.email


def jsonable(value):
    return json.loads(json.dumps(value, cls=DjangoJSONEncoder))


def policy_data(policy, workspace=False):
    data = {"mode": "inherit", "expires_at": None, "reason": ""}
    if workspace:
        data["seat_limit_override"] = None
    if policy:
        data.update({"mode": policy.mode, "expires_at": policy.expires_at, "reason": policy.reason})
        if workspace:
            data["seat_limit_override"] = policy.seat_limit_override
    return data


def user_data(user):
    return {
        "id": user.id, "email": user.email, "name": profile_name(user), "status": user.status,
        "is_staff": user.is_staff, "is_superuser": user.is_superuser,
        "email_verified_at": user.email_verified_at, "created_at": user.created_at,
        "last_login_at": user.last_login, "workspace_count": getattr(user, "workspace_count", user.memberships.count()),
        "access_policy": policy_data(getattr(user, "access_policy", None)),
    }


def member_data(member):
    return {
        "id": member.id, "user_id": member.user_id, "email": member.user.email,
        "name": profile_name(member.user), "role": member.role, "is_active": member.is_active,
        "joined_at": member.joined_at, "user_status": member.user.status,
    }


def workspace_data(workspace):
    subscription = get_subscription(workspace)
    used, limit = get_active_seat_count(workspace), get_seat_limit(workspace)
    decision = evaluate_workspace_access(workspace.owner, workspace)
    return {
        "id": workspace.id, "name": workspace.name, "slug": workspace.slug,
        "workspace_type": workspace.workspace_type, "status": workspace.status,
        "currency_code": workspace.currency_code,
        "owner": {"id": workspace.owner_id, "email": workspace.owner.email, "name": profile_name(workspace.owner)},
        "access_policy": policy_data(getattr(workspace, "access_policy", None), True),
        "effective_access": decision,
        "subscription": None if not subscription else {
            "id": subscription.id, "status": subscription.status,
            "is_active": subscription.status in ("active", "trialing"), "plan_id": subscription.plan_id,
            "plan_name": subscription.plan.name, "monthly_price": subscription.plan.monthly_price,
            "plan_max_members": subscription.plan.max_members,
        },
        "seats": {"used": used, "limit": limit, "available": max(limit - used, 0), "at_limit": used >= limit},
        "members": [member_data(member) for member in workspace.memberships.all()],
        "created_at": workspace.created_at, "updated_at": workspace.updated_at,
    }


def workspace_queryset():
    member_qs = WorkspaceMember.objects.select_related("user", "user__profile").order_by("joined_at")
    return Workspace.objects.select_related("owner", "owner__profile", "access_policy").prefetch_related(
        Prefetch("memberships", queryset=member_qs),
        Prefetch("subscription", queryset=Subscription.objects.select_related("plan").order_by("-updated_at")),
    ).order_by("name")


class OverviewView(APIView):
    permission_classes = [IsPlatformAccessAdmin]

    def get(self, request):
        users = User.objects.select_related("profile", "access_policy").annotate(workspace_count=Count("memberships", distinct=True)).order_by("-created_at")
        workspaces = list(workspace_queryset())
        workspace_payload = [workspace_data(workspace) for workspace in workspaces]
        return Response({
            "summary": {
                "users_total": users.count(), "users_active": users.filter(status="active").count(),
                "free_user_overrides": UserAccessPolicy.objects.filter(mode="free").filter(Q(expires_at__isnull=True) | Q(expires_at__gt=timezone.now())).count(),
                "workspaces_total": len(workspaces), "companies": sum(w.workspace_type == "company" for w in workspaces),
                "blocked_workspaces": WorkspaceAccessPolicy.objects.filter(mode="blocked").filter(Q(expires_at__isnull=True) | Q(expires_at__gt=timezone.now())).count(),
                "seats_used": sum(item["seats"]["used"] for item in workspace_payload),
                "seats_limit": sum(item["seats"]["limit"] for item in workspace_payload),
            },
            "users": [user_data(user) for user in users],
            "workspaces": workspace_payload,
        })


class UserPolicyView(APIView):
    permission_classes = [IsPlatformAccessAdmin]

    @transaction.atomic
    def patch(self, request, user_id):
        user = get_object_or_404(User.objects.select_for_update().select_related("profile", "access_policy"), id=user_id)
        serializer = UserPolicyUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        before = user_data(user)
        values = serializer.validated_data
        if "status" in values:
            user.status = values["status"]; user.save(update_fields=["status", "updated_at"])
        if any(key in values for key in ("access_mode", "expires_at", "reason")):
            policy, _ = UserAccessPolicy.objects.update_or_create(user=user, defaults={
                "mode": values.get("access_mode", getattr(getattr(user, "access_policy", None), "mode", "inherit")),
                "expires_at": values.get("expires_at", getattr(getattr(user, "access_policy", None), "expires_at", None)),
                "reason": values.get("reason", getattr(getattr(user, "access_policy", None), "reason", "")),
                "updated_by": request.user,
            })
            user.access_policy = policy
        after = user_data(user)
        AccessAuditLog.objects.create(actor=request.user, action="user_policy_updated", target_type="user", target_id=str(user.id), before=jsonable(before), after=jsonable(after))
        return Response(after)


class WorkspacePolicyView(APIView):
    permission_classes = [IsPlatformAccessAdmin]

    @transaction.atomic
    def patch(self, request, workspace_id):
        workspace = get_object_or_404(Workspace.objects.select_for_update(), id=workspace_id)
        before = workspace_data(workspace_queryset().get(id=workspace.id))
        serializer = WorkspacePolicyUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        values = serializer.validated_data
        if "status" in values:
            workspace.status = values["status"]; workspace.save(update_fields=["status", "updated_at"])
        if any(key in values for key in ("access_mode", "seat_limit_override", "expires_at", "reason")):
            current = getattr(workspace, "access_policy", None)
            WorkspaceAccessPolicy.objects.update_or_create(workspace=workspace, defaults={
                "mode": values.get("access_mode", getattr(current, "mode", "inherit")),
                "seat_limit_override": values.get("seat_limit_override", getattr(current, "seat_limit_override", None)),
                "expires_at": values.get("expires_at", getattr(current, "expires_at", None)),
                "reason": values.get("reason", getattr(current, "reason", "")), "updated_by": request.user,
            })
        after = workspace_data(workspace_queryset().get(id=workspace.id))
        AccessAuditLog.objects.create(actor=request.user, action="workspace_policy_updated", target_type="workspace", target_id=str(workspace.id), before=jsonable(before), after=jsonable(after))
        return Response(after)


class MemberView(APIView):
    permission_classes = [IsPlatformAccessAdmin]

    @transaction.atomic
    def patch(self, request, workspace_id, member_id):
        member = get_object_or_404(WorkspaceMember.objects.select_for_update().select_related("workspace", "user"), id=member_id, workspace_id=workspace_id)
        serializer = MemberUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        values = serializer.validated_data
        owner_count = member.workspace.memberships.filter(role="owner", is_active=True).count()
        removing_owner = member.role == "owner" and member.is_active and (values.get("role", member.role) != "owner" or values.get("is_active", member.is_active) is False)
        if removing_owner and owner_count <= 1:
            return Response({"detail": "No puedes degradar ni suspender al único owner activo del workspace."}, status=status.HTTP_400_BAD_REQUEST)
        if values.get("is_active") is True and not member.is_active and not can_add_member(member.workspace):
            return Response({"detail": seat_limit_error(member.workspace)}, status=status.HTTP_400_BAD_REQUEST)
        before = member_data(member)
        for field, value in values.items():
            setattr(member, field, value)
        member.save(update_fields=list(values))
        after = member_data(member)
        AccessAuditLog.objects.create(actor=request.user, action="member_updated", target_type="workspace_member", target_id=str(member.id), before=jsonable(before), after=jsonable(after))
        return Response(workspace_data(workspace_queryset().get(id=workspace_id)))
