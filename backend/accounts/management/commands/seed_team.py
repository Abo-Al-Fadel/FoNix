"""
Seeds a demo staff team so the control panel can be explored end to end.

Creates one account per non-customer role -- owner, admin, staff -- if it does
not already exist, and promotes the project's superuser to the Owner role so its
`role` column matches the access it already has.

Idempotent: run it as many times as you like. It never changes an existing demo
account's password (so a password you have changed by hand survives), and it
prints exactly what it did.

    ../backend_venv/Scripts/python manage.py seed_team

The passwords here are deliberately obvious and are for LOCAL DEVELOPMENT ONLY.
Nothing about this command should ever run against a real deployment; it is a
convenience for demoing the roles, in the same spirit as seed_catalog.
"""

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError

User = get_user_model()

# (username, email, first_name, role, dev password). One demo account per tier.
DEMO_TEAM = [
    ("owner", "owner@fonix.test", "Ola", User.Role.OWNER, "owner-demo-2049"),
    ("admin", "admin@fonix.test", "Amir", User.Role.ADMIN, "admin-demo-2049"),
    ("staff", "staff@fonix.test", "Sam", User.Role.STAFF, "staff-demo-2049"),
]

# The superuser created during setup; promoted to Owner for clean data.
SUPERUSER_USERNAME = "fonix"


class Command(BaseCommand):
    help = "Create demo owner/admin/staff accounts and promote the superuser to Owner."

    def add_arguments(self, parser):
        parser.add_argument(
            "--force",
            action="store_true",
            help=(
                "Allow running with DEBUG=False. Only for a portfolio-demo host "
                "whose whole point is the published demo logins (see "
                "backend/render-start.sh). The passwords are public; never use "
                "this where the accounts are real."
            ),
        )

    def handle(self, *args, **options):
        if not settings.DEBUG and not options["force"]:
            raise CommandError(
                "seed_team is for local development only. It creates accounts "
                "with published demo passwords and must not run in production. "
                "Pass --force on a demo host that intends this (see "
                "backend/render-start.sh)."
            )

        for username, email, first_name, role, password in DEMO_TEAM:
            user, created = User.objects.get_or_create(
                username=username,
                defaults={
                    "email": email,
                    "first_name": first_name,
                    "role": role,
                },
            )
            if created:
                # set_password hashes it; assigning .password would store plaintext.
                user.set_password(password)
                user.save(update_fields=["password"])
                self.stdout.write(
                    self.style.SUCCESS(
                        f"  Created {username} ({role}) -- password: {password}"
                    )
                )
            elif user.role != role:
                # Account exists but at the wrong tier: correct the role, leave
                # the password alone.
                user.role = role
                user.save(update_fields=["role"])
                self.stdout.write(f"  Updated {username} role -> {role}")
            else:
                self.stdout.write(f"  {username} already present ({role}); left as is")

        # Promote the superuser so its role column reflects reality.
        try:
            superuser = User.objects.get(username=SUPERUSER_USERNAME)
        except User.DoesNotExist:
            self.stdout.write(
                f"  (no '{SUPERUSER_USERNAME}' superuser found to promote; skipping)"
            )
        else:
            if superuser.role != User.Role.OWNER:
                superuser.role = User.Role.OWNER
                superuser.save(update_fields=["role"])
                self.stdout.write(
                    self.style.SUCCESS(f"  Promoted {SUPERUSER_USERNAME} -> Owner")
                )
            else:
                self.stdout.write(f"  {SUPERUSER_USERNAME} is already Owner")

        self.stdout.write(self.style.SUCCESS("Team ready."))
