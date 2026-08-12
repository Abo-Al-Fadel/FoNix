from rest_framework import permissions


class IsAdminOrReadOnly(permissions.BasePermission):
    """
    Anyone may read the catalog; only FoNix admins may change it.

    The alternative -- an `if request.user.role != "admin": raise PermissionDenied`
    at the top of every mutating view -- is how endpoints get missed. Expressing
    it as a permission class means the rule is declared once and DRF applies it
    to every action on the ViewSet, including ones added later.
    """

    message = "Only FoNix staff accounts can modify the catalog."

    def has_permission(self, request, view) -> bool:
        # SAFE_METHODS is ("GET", "HEAD", "OPTIONS") -- the methods that cannot
        # change server state. The store front page must work for a logged-out
        # visitor, so these are open to everyone.
        if request.method in permissions.SAFE_METHODS:
            return True

        user = request.user
        # Delegates to the user model rather than comparing the role string
        # here, so "what is an admin" stays defined in exactly one place.
        return bool(user and user.is_authenticated and user.is_fonix_admin)
