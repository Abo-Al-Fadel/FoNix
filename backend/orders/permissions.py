from rest_framework import permissions


class IsOrderOwnerOrAdmin(permissions.BasePermission):
    """
    Object-level guard for a single order.

    The queryset in the view is already scoped with .for_user(), so a customer
    requesting someone else's order id gets a 404. This class is the belt to
    that queryset's braces: object permissions are what protect any future
    action that fetches an object by a route other than get_queryset().

    A 404 (from the scoped queryset) is actually the better default response of
    the two -- a 403 confirms that order #12 exists, which is information a
    stranger has no business learning.
    """

    message = "You can only access your own orders."

    def has_object_permission(self, request, view, obj) -> bool:
        user = request.user
        if not (user and user.is_authenticated):
            return False
        return obj.user_id == user.id or user.is_staff_member
