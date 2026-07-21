import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone

from accounts.models import Workspace


class Plan(models.Model):
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )
    name = models.CharField(
        max_length=100,
        unique=True,
    )
    description = models.TextField(blank=True)
    monthly_price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
    )
    annual_price = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True
    )
    currency_code = models.CharField(
        max_length=3,
        default="USD",
    )
    monthly_credits = models.PositiveIntegerField(
        default=100,
    )
    storage_limit_mb = models.PositiveIntegerField(
        default=1000,
    )
    max_members = models.PositiveIntegerField(
        default=1,
    )
    is_active = models.BooleanField(
        default=True,
    )
    created_at = models.DateTimeField(default=timezone.now, editable=False)
    updated_at = models.DateTimeField(auto_now=True)


class Subscription(models.Model):
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )
    workspace = models.ForeignKey(
        Workspace,
        on_delete=models.CASCADE,
        related_name="subscription",
    )
    plan = models.ForeignKey(
        Plan,
        on_delete=models.PROTECT,
    )
    status = models.CharField(
        max_length=20,
        default="trialing",
    )
    provider = models.CharField(max_length=50, blank=True)
    external_subscription_id = models.CharField(
        max_length=255, null=True, blank=True, unique=True
    )
    member_limit_override = models.PositiveIntegerField(
        null=True,
        blank=True,
    )
    credit_limit_override = models.PositiveIntegerField(
        null=True,
        blank=True,
    )
    storage_limit_mb_override = models.PositiveIntegerField(null=True, blank=True)
    current_period_start = models.DateTimeField(
        null=True,
        blank=True,
    )
    current_period_end = models.DateTimeField(
        null=True,
        blank=True,
    )
    cancel_at_period_end = models.BooleanField(default=False)
    created_at = models.DateTimeField(default=timezone.now, editable=False)
    updated_at = models.DateTimeField(auto_now=True)


class CreditBalance(models.Model):
    workspace = models.OneToOneField(
        Workspace,
        on_delete=models.CASCADE,
        related_name="credit_balance",
    )
    available_credits = models.IntegerField(
        default=0,
    )
    reserved_credits = models.IntegerField(
        default=0,
    )
    updated_at = models.DateTimeField(
        auto_now=True,
    )


class CreditMovement(models.Model):
    MOVEMENT_TYPES = [
        (value, value)
        for value in (
            "allocation",
            "purchase",
            "consumption",
            "refund",
            "adjustment",
            "expiration",
        )
    ]

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )
    workspace = models.ForeignKey(
        Workspace,
        on_delete=models.CASCADE,
        related_name="credit_movements",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
    )
    generation_job = models.ForeignKey(
        "studio.GenerationJob",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="credit_movements",
    )
    movement_type = models.CharField(
        max_length=20,
        choices=MOVEMENT_TYPES,
    )
    credits = models.IntegerField()
    description = models.TextField(
        blank=True,
    )
    expires_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(
        auto_now_add=True,
    )


class SubscriptionLimitChange(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    subscription = models.ForeignKey(
        Subscription, on_delete=models.CASCADE, related_name="limit_changes"
    )
    changed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="subscription_limit_changes",
    )
    limit_type = models.CharField(max_length=50)
    old_value = models.IntegerField(null=True, blank=True)
    new_value = models.IntegerField(null=True, blank=True)
    reason = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
