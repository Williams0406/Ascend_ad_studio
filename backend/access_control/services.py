from django.db import models
from django.utils import timezone

from accounts.models import WorkspaceMember
from billing.models import Subscription
from .models import PolicyMode


def policy_is_current(policy):
    return bool(policy and (policy.expires_at is None or policy.expires_at > timezone.now()))


def get_subscription(workspace):
    subscriptions = workspace.subscription.select_related("plan").all()
    now = timezone.now()
    current = subscriptions.filter(status__in=("active", "trialing")).filter(
        models.Q(current_period_end__isnull=True) | models.Q(current_period_end__gt=now)
    ).order_by("-updated_at").first()
    return current or subscriptions.order_by("-updated_at").first()


def get_seat_limit(workspace):
    policy = getattr(workspace, "access_policy", None)
    if policy_is_current(policy) and policy.seat_limit_override:
        return policy.seat_limit_override
    subscription = get_subscription(workspace)
    return subscription.plan.max_members if subscription and subscription.plan_id else 1


def get_active_seat_count(workspace):
    return workspace.memberships.filter(is_active=True).count()


def can_add_member(workspace):
    used, limit = get_active_seat_count(workspace), get_seat_limit(workspace)
    return used < limit


def seat_limit_error(workspace):
    used, limit = get_active_seat_count(workspace), get_seat_limit(workspace)
    return f"El workspace alcanzó su límite de usuarios ({used}/{limit}). Cambia el plan o concede más asientos."


def evaluate_workspace_access(user, workspace):
    if not user or not user.is_authenticated:
        return {"allowed": False, "source": "authentication", "reason": "Debes iniciar sesión."}
    if user.status != "active":
        return {"allowed": False, "source": "user_status", "reason": "Tu cuenta no está activa."}
    user_policy = getattr(user, "access_policy", None)
    if policy_is_current(user_policy) and user_policy.mode == PolicyMode.BLOCKED:
        return {"allowed": False, "source": "user_policy", "reason": user_policy.reason or "Tu acceso fue bloqueado."}
    if not WorkspaceMember.objects.filter(workspace=workspace, user=user, is_active=True).exists():
        return {"allowed": False, "source": "membership", "reason": "No eres miembro activo de este workspace."}
    if workspace.status != "active":
        return {"allowed": False, "source": "workspace_status", "reason": "El workspace no está activo."}
    workspace_policy = getattr(workspace, "access_policy", None)
    if policy_is_current(workspace_policy) and workspace_policy.mode == PolicyMode.BLOCKED:
        return {"allowed": False, "source": "workspace_policy", "reason": workspace_policy.reason or "El workspace fue bloqueado."}
    if policy_is_current(user_policy) and user_policy.mode == PolicyMode.FREE:
        return {"allowed": True, "source": "user_policy", "reason": "Acceso gratuito personal."}
    if policy_is_current(workspace_policy) and workspace_policy.mode == PolicyMode.FREE:
        return {"allowed": True, "source": "workspace_policy", "reason": "Acceso gratuito del workspace."}
    subscription = get_subscription(workspace)
    if subscription and subscription.status in ("active", "trialing"):
        return {"allowed": True, "source": "subscription", "reason": "Suscripción activa."}
    return {"allowed": False, "source": "subscription", "reason": "El workspace no tiene una suscripción activa."}
