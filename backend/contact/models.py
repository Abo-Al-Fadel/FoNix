from django.conf import settings
from django.db import models


class ContactMessage(models.Model):
    """
    An enquiry submitted from the /contact page.

    No email is sent (explicitly out of scope) -- messages are persisted and
    read in the Django admin. That is a deliberate v1 boundary, not an
    oversight: wiring an SMTP provider would add a secret, a failure mode and a
    retry story to a form that currently has none.
    """

    name = models.CharField(max_length=120)
    email = models.EmailField()
    subject = models.CharField(max_length=200, blank=True)
    message = models.TextField()

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        # Anonymous visitors can use the form, so this must be nullable. SET_NULL
        # rather than PROTECT: unlike an order, an enquiry is not a financial
        # record, and it should survive the deletion of the account that sent it
        # without blocking that deletion.
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="contact_messages",
        help_text="Set automatically when the sender is logged in.",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    is_handled = models.BooleanField(default=False)

    class Meta:
        ordering = ("-created_at",)

    def __str__(self) -> str:
        return f"{self.name} <{self.email}>: {self.subject or 'No subject'}"
