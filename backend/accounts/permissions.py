from rest_framework import permissions


class IsAdminRole(permissions.BasePermission):
    """
    Allows access only to users with the FoNix admin role (or a superuser).

    This lives in `accounts` rather than in the app that happens to use it
    first, because "what counts as an admin" is a property of the user model.
    cars and orders both import from here, so the day the rule changes (an
    is_staff check, a group membership, an org-scoped role) there is exactly
    one place to change it.
    """

    message = "This action is restricted to FoNix staff accounts."

    def has_permission(self, request, view) -> bool:
        user = request.user
        # `is_authenticated` first: AnonymousUser has no `is_fonix_admin`, and
        # `and` short-circuits before we touch the missing attribute.
        return bool(user and user.is_authenticated and user.is_fonix_admin)
