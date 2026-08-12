from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    """
    FoNix's user model.

    Subclassing AbstractUser (rather than AbstractBaseUser) keeps everything
    Django already gives us -- password hashing, permissions, the admin
    integration -- and only adds what this project needs on top.

    Why do this on day one? AUTH_USER_MODEL is baked into every migration that
    references a user. Swapping it after the first migration has run means
    hand-editing migration history or dropping the database. Doing it up front
    costs one file; doing it later costs an afternoon.
    """

    class Role(models.TextChoices):
        # TextChoices over a bare list of tuples: it gives us User.Role.ADMIN as
        # a named constant, so a typo like "admn" is an AttributeError at import
        # time instead of a comparison that silently returns False forever.
        CUSTOMER = "customer", "Customer"
        ADMIN = "admin", "Admin"

    role = models.CharField(
        max_length=10,
        choices=Role.choices,
        default=Role.CUSTOMER,
        help_text="Determines API write access. Customers get read-only catalog access.",
    )

    email = models.EmailField(
        "email address",
        unique=True,
        help_text="Unique because the frontend treats email as an account identifier.",
    )

    @property
    def is_fonix_admin(self) -> bool:
        """
        Single source of truth for "may this user mutate the catalog?".

        Deliberately also true for superusers: a superuser created via
        `createsuperuser` has role="customer" by default, and it would be
        surprising (and a support burden) if the person who owns the database
        could not use the API they administer.

        Permission classes call this instead of comparing `user.role` inline, so
        the rule lives in exactly one place -- see cars/permissions.py.
        """
        return self.role == self.Role.ADMIN or self.is_superuser

    def __str__(self) -> str:
        return f"{self.username} ({self.role})"
