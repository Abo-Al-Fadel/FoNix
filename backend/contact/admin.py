from django.contrib import admin

from .models import ContactMessage


@admin.register(ContactMessage)
class ContactMessageAdmin(admin.ModelAdmin):
    list_display = ("name", "email", "subject", "is_handled", "created_at")
    list_filter = ("is_handled", "created_at")
    search_fields = ("name", "email", "subject", "message")
    # is_handled is the only field staff should change -- the rest is what the
    # sender actually wrote, and editing it would misrepresent them.
    readonly_fields = ("name", "email", "subject", "message", "user", "created_at")
    list_editable = ("is_handled",)
