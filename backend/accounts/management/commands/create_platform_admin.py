import getpass
import os

from django.core.management.base import BaseCommand, CommandError
from django.core.validators import validate_email
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone
from django.utils.text import slugify

from accounts.models import (
    IndividualProfile,
    PersonProfile,
    PlatformAdmin,
    User,
    Workspace,
    WorkspaceMember,
)
from billing.models import Plan, Subscription


class Command(BaseCommand):
    help = "Crea o actualiza una cuenta administradora de plataforma y su workspace."

    def add_arguments(self, parser):
        parser.add_argument("--email", default=os.getenv("ADMIN_EMAIL"))
        parser.add_argument("--password", default=os.getenv("ADMIN_PASSWORD"))
        parser.add_argument("--first-name", default=os.getenv("ADMIN_FIRST_NAME", "Admin"))
        parser.add_argument("--last-name", default=os.getenv("ADMIN_LAST_NAME", "Ascend"))
        parser.add_argument("--workspace", default=os.getenv("ADMIN_WORKSPACE", "Ascend Admin"))
        parser.add_argument(
            "--role",
            choices=[choice[0] for choice in PlatformAdmin.ROLES],
            default=os.getenv("ADMIN_ROLE", "super_admin"),
        )
        parser.add_argument("--noinput", action="store_true")

    @transaction.atomic
    def handle(self, *args, **options):
        email = (options["email"] or "").strip().lower()
        if not email:
            if options["noinput"]:
                raise CommandError("Indica --email o configura ADMIN_EMAIL.")
            email = input("Correo del administrador: ").strip().lower()
        if not email:
            raise CommandError("El correo es obligatorio.")
        try:
            validate_email(email)
        except ValidationError as exc:
            raise CommandError("El correo del administrador no es válido.") from exc

        password = options["password"]
        if not password and not options["noinput"]:
            password = getpass.getpass("Contraseña: ")
            confirmation = getpass.getpass("Confirma la contraseña: ")
            if password != confirmation:
                raise CommandError("Las contraseñas no coinciden.")
        if not password:
            raise CommandError("Indica --password, configura ADMIN_PASSWORD o ejecuta el comando de forma interactiva.")
        if len(password) < 12:
            raise CommandError("La contraseña administradora debe tener al menos 12 caracteres.")

        user, created = User.objects.get_or_create(
            email=email,
            defaults={"status": "active", "is_staff": True, "is_superuser": True},
        )
        try:
            validate_password(password, user=user)
        except ValidationError as exc:
            raise CommandError(" ".join(exc.messages)) from exc
        user.status = "active"
        user.is_staff = True
        user.is_superuser = True
        user.email_verified_at = user.email_verified_at or timezone.now()
        user.set_password(password)
        user.save()

        PersonProfile.objects.update_or_create(
            user=user,
            defaults={"first_name": options["first_name"], "last_name": options["last_name"]},
        )
        PlatformAdmin.objects.update_or_create(
            user=user,
            defaults={"role": options["role"], "is_active": True},
        )

        workspace = Workspace.objects.filter(owner=user, status="active").first()
        if workspace is None:
            base_slug = slugify(options["workspace"]) or "ascend-admin"
            slug = base_slug
            suffix = 1
            while Workspace.objects.filter(slug=slug).exists():
                suffix += 1
                slug = f"{base_slug}-{suffix}"
            workspace = Workspace.objects.create(
                name=options["workspace"],
                slug=slug,
                workspace_type="individual",
                owner=user,
            )

        WorkspaceMember.objects.update_or_create(
            workspace=workspace,
            user=user,
            defaults={"role": "owner", "is_active": True},
        )
        if workspace.workspace_type == "individual":
            IndividualProfile.objects.get_or_create(
                workspace=workspace,
                defaults={"business_name": workspace.name, "professional_activity": "Administración de plataforma"},
            )

        plan, _ = Plan.objects.get_or_create(
            name="Admin",
            defaults={
                "description": "Plan interno para administración de Ascend.",
                "monthly_price": 0,
                "max_members": 10,
            },
        )
        Subscription.objects.get_or_create(
            workspace=workspace,
            defaults={"plan": plan, "status": "active"},
        )
        action = "creada" if created else "actualizada"
        self.stdout.write(self.style.SUCCESS(f"Cuenta administradora {action}: {email}"))
        self.stdout.write(f"Workspace: {workspace.name} ({workspace.id})")
        self.stdout.write("Acceso Django Admin: habilitado")
        self.stdout.write(f"Rol de plataforma: {options['role']}")
