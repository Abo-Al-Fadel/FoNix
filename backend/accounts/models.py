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
        #
        # Declared low-to-high so the order also reads as the hierarchy. The
        # numeric ranking that powers the "at least this role" checks lives in
        # ROLE_RANK below, keyed by these same values.
        CUSTOMER = "customer", "Customer"
        STAFF = "staff", "Staff"
        ADMIN = "admin", "Admin"
        OWNER = "owner", "Owner"

    # The hierarchy as numbers. A higher rank can do everything a lower one can.
    # Kept as a plain dict (not a field) because it is behaviour, not data: it
    # never varies per row and must never be editable in the admin.
    ROLE_RANK = {
        Role.CUSTOMER: 0,
        Role.STAFF: 1,
        Role.ADMIN: 2,
        Role.OWNER: 3,
    }

    role = models.CharField(
        # 20, not the tightest possible width: the longest current value is
        # "customer" (8), but leaving headroom means a future role does not force
        # another column-altering migration on a table this central.
        max_length=20,
        choices=Role.choices,
        default=Role.CUSTOMER,
        help_text="Determines control-panel access. See ROLES.md for the full matrix.",
    )

    email = models.EmailField(
        "email address",
        unique=True,
        help_text="Unique because the frontend treats email as an account identifier.",
    )

    @property
    def role_rank(self) -> int:
        """
        This user's position in the hierarchy as a number.

        A superuser is treated as the top rank regardless of its `role` column:
        `createsuperuser` does not ask for `role`, so the person who owns the
        database would otherwise rank as a customer. Everything below is phrased
        as "rank >= X", so pinning a superuser to the top makes every gate open
        for them without a special case in each one.
        """
        if self.is_superuser:
            return self.ROLE_RANK[self.Role.OWNER]
        return self.ROLE_RANK.get(self.role, 0)

    @property
    def is_owner(self) -> bool:
        """Top tier: oversight, and the only role that can grant the Owner role."""
        return self.role_rank >= self.ROLE_RANK[self.Role.OWNER]

    @property
    def is_admin(self) -> bool:
        """Admin or Owner: manage users, roles (below Owner), and order tracking."""
        return self.role_rank >= self.ROLE_RANK[self.Role.ADMIN]

    @property
    def is_staff_member(self) -> bool:
        """Staff, Admin or Owner: may manage the catalogue (add/edit/hide cars).

        Named `is_staff_member`, not `is_staff`, because `is_staff` is Django's
        own field controlling access to the built-in /admin/ site -- shadowing it
        with a property would break that. This is the FoNix control-panel gate.
        """
        return self.role_rank >= self.ROLE_RANK[self.Role.STAFF]

    @property
    def is_fonix_admin(self) -> bool:
        """
        Backwards-compatible alias of `is_admin`.

        Predates the role hierarchy, when the only distinction was customer vs
        admin. Several permission classes and the order queryset still call it
        (cars/permissions.py, orders/permissions.py, orders/models.py); keeping
        it as an alias means "admin sees every order" keeps working untouched
        while new code uses the clearer `is_admin` / `is_staff_member` / `is_owner`.
        """
        return self.is_admin

    def __str__(self) -> str:
        return f"{self.username} ({self.role})"
