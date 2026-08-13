from rest_framework import permissions

# The permission ladder for the FoNix control panel.
#
# "What counts as staff / admin / owner" is a property of the user model, so the
# gates live here in `accounts` rather than in whichever app uses one first. cars
# and orders import from here; the day the rule changes there is one place to
# change it. Each class is a thin wrapper over a rank property on the User model
# (see accounts/models.py), so the actual hierarchy lives in exactly one spot.


class IsStaffMember(permissions.BasePermission):
    """Staff, Admin or Owner. The gate for managing the catalogue."""

    message = "This action is restricted to FoNix staff accounts."

    def has_permission(self, request, view) -> bool:
        user = request.user
        # `is_authenticated` first: AnonymousUser has no `is_staff_member`, and
        # `and` short-circuits before we touch the missing attribute.
        return bool(user and user.is_authenticated and user.is_staff_member)


class IsAdmin(permissions.BasePermission):
    """Admin or Owner. The gate for user management and order tracking."""

    message = "This action is restricted to FoNix administrators."

    def has_permission(self, request, view) -> bool:
        user = request.user
        return bool(user and user.is_authenticated and user.is_admin)


class IsOwner(permissions.BasePermission):
    """Owner only. The gate for the most sensitive actions (granting Owner)."""

    message = "This action is restricted to the FoNix owner."

    def has_permission(self, request, view) -> bool:
        user = request.user
        return bool(user and user.is_authenticated and user.is_owner)


# Kept as an alias so any older import of `IsAdminRole` still resolves. New code
# should use the named tiers above.
IsAdminRole = IsAdmin


class CanManageUser(permissions.BasePermission):
    """
    Object-level guardrails for editing *another* user through the admin API.

    `IsAdmin` (checked alongside this) already establishes the actor is an admin
    or owner. This adds the who-may-touch-whom rules that a flat role check
    cannot express. The heavy lifting for *what* a change may set (which role,
    activating vs deactivating) lives in UserAdminSerializer.validate, which has
    the incoming data; this class guards the target object itself.

    Rules (see ROLES.md):
      - Nobody may act on their own account here (no self role-change, no
        self-deactivation). Editing your own profile is what /api/auth/me/ is for.
      - Only an Owner may act on another Owner. An Admin touching any Owner is a
        403 -- an Admin cannot change anything about an Owner's account.
    """

    message = "You do not have permission to manage this account."

    def has_object_permission(self, request, view, obj) -> bool:
        actor = request.user

        # Reads (retrieve) are fine for any admin; the guardrails are about writes.
        if request.method in permissions.SAFE_METHODS:
            return True

        # You cannot manage yourself through this endpoint.
        if obj.pk == actor.pk:
            self.message = "You cannot change your own role or status here."
            return False

        # Only an owner may act on another owner.
        if obj.is_owner and not actor.is_owner:
            self.message = "Only an owner can manage another owner's account."
            return False

        return True
