from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    """
    Extends Django's UserAdmin rather than using a plain ModelAdmin.

    That matters: the stock UserAdmin knows to render the password field as a
    hash-with-reset-link instead of a plain text input, and it uses the
    add-form that hashes the password on creation. A bare
    `admin.site.register(User)` would happily store an unhashed password typed
    into the admin form.
    """

    # Append our custom field to the parent's fieldsets instead of redeclaring
    # them, so we inherit any future upstream changes.
    fieldsets = BaseUserAdmin.fieldsets + (("FoNix", {"fields": ("role",)}),)
    add_fieldsets = BaseUserAdmin.add_fieldsets + (
        ("FoNix", {"fields": ("email", "role")}),
    )

    list_display = ("username", "email", "role", "is_staff", "is_superuser")
    list_filter = BaseUserAdmin.list_filter + ("role",)
