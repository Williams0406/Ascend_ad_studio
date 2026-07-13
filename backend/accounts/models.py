import uuid

from django.contrib.auth.models import (
    AbstractBaseUser,
    BaseUserManager,
    PermissionsMixin,
)
from django.db import models


class UserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra):
        if not email:
            raise ValueError("El correo es obligatorio")

        email = self.normalize_email(email).lower()

        user = self.model(
            email=email,
            **extra,
        )

        user.set_password(password)
        user.save(using=self._db)

        return user

    def create_superuser(self, email, password=None, **extra):
        extra.setdefault("is_staff", True)
        extra.setdefault("is_superuser", True)
        extra.setdefault("status", "active")

        return self.create_user(email, password, **extra)


class User(AbstractBaseUser, PermissionsMixin):
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )

    email = models.EmailField(unique=True)

    status = models.CharField(
        max_length=20,
        default="pending",
        choices=[
            ("pending", "Pendiente"),
            ("active", "Activo"),
            ("suspended", "Suspendido"),
            ("deleted", "Eliminado"),
        ],
    )

    is_staff = models.BooleanField(default=False)

    email_verified_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    def __str__(self):
        return self.email


class PersonProfile(models.Model):
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )

    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name="profile",
    )

    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)

    phone = models.CharField(
        max_length=30,
        blank=True,
    )

    job_title = models.CharField(
        max_length=150,
        blank=True,
    )

    avatar_url = models.URLField(blank=True)

    country_code = models.CharField(
        max_length=2,
        blank=True,
    )

    city = models.CharField(
        max_length=150,
        blank=True,
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)


class Workspace(models.Model):
    TYPES = [
        ("individual", "Individual"),
        ("company", "Empresa"),
    ]

    STATUSES = [
        ("active", "Activo"),
        ("suspended", "Suspendido"),
        ("cancelled", "Cancelado"),
    ]

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )

    name = models.CharField(max_length=200)

    slug = models.SlugField(unique=True)

    workspace_type = models.CharField(
        max_length=20,
        choices=TYPES,
    )

    owner = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name="owned_workspaces",
    )

    status = models.CharField(
        max_length=20,
        choices=STATUSES,
        default="active",
    )

    currency_code = models.CharField(
        max_length=3,
        default="PEN",
    )

    timezone = models.CharField(
        max_length=100,
        default="America/Lima",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name


class WorkspaceMember(models.Model):
    ROLES = [
        ("owner", "Owner"),
        ("admin", "Admin"),
        ("editor", "Editor"),
        ("viewer", "Viewer"),
    ]

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )

    workspace = models.ForeignKey(
        Workspace,
        on_delete=models.CASCADE,
        related_name="memberships",
    )

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="memberships",
    )

    role = models.CharField(
        max_length=20,
        choices=ROLES,
        default="editor",
    )

    is_active = models.BooleanField(default=True)

    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["workspace", "user"],
                name="unique_workspace_user",
            ),
        ]


class CompanyProfile(models.Model):
    workspace = models.OneToOneField(
        Workspace,
        on_delete=models.CASCADE,
        related_name="company_profile",
    )

    legal_name = models.CharField(max_length=255)

    trade_name = models.CharField(
        max_length=255,
        blank=True,
    )

    tax_identifier = models.CharField(
        max_length=50,
        blank=True,
    )

    industry = models.CharField(
        max_length=150,
        blank=True,
    )

    company_size = models.CharField(
        max_length=50,
        blank=True,
    )

    website_url = models.URLField(blank=True)

    phone = models.CharField(
        max_length=30,
        blank=True,
    )

    country_code = models.CharField(
        max_length=2,
        blank=True,
    )

    city = models.CharField(
        max_length=150,
        blank=True,
    )

    address = models.TextField(blank=True)


class IndividualProfile(models.Model):
    workspace = models.OneToOneField(
        Workspace,
        on_delete=models.CASCADE,
        related_name="individual_profile",
    )

    business_name = models.CharField(
        max_length=200,
        blank=True,
    )

    professional_activity = models.CharField(
        max_length=200,
        blank=True,
    )

    website_url = models.URLField(blank=True)

    social_media_urls = models.JSONField(
        default=list,
        blank=True,
    )

    tax_identifier = models.CharField(
        max_length=50,
        blank=True,
    )


class PlatformAdmin(models.Model):
    ROLES = [
        ("super_admin", "Super Admin"),
        ("billing_admin", "Billing Admin"),
        ("support_admin", "Support Admin"),
    ]

    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name="platform_admin",
    )

    role = models.CharField(
        max_length=30,
        choices=ROLES,
    )

    is_active = models.BooleanField(default=True)