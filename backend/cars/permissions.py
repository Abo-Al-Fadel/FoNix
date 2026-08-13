from rest_framework import permissions


class IsStaffOrReadOnly(permissions.BasePermission):
    """
    Anyone may read the catalog; only FoNix staff (Staff, Admin or Owner) may
    change it.

    The alternative -- an `if not request.user.is_staff_member: raise
    PermissionDenied` at the top of every mutating view -- is how endpoints get
    missed. Expressing it as a permission class means the rule is declared once
    and DRF applies it to every action on the ViewSet, including ones added later.

    Managing the catalogue is the Staff tier's whole job, so this gate is
    `is_staff_member`, not `is_admin`: a workshop staffer can add, edit and hide
    cars without being able to touch users or orders.
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
        # here, so "what is staff" stays defined in exactly one place.
        return bool(user and user.is_authenticated and user.is_staff_member)


# Old name kept as an alias so nothing importing IsAdminOrReadOnly breaks. The
# gate is now staff-and-above, which is a superset of the old admin-only rule.
IsAdminOrReadOnly = IsStaffOrReadOnly
