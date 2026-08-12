from rest_framework import serializers

from .models import ContactMessage


class ContactMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ContactMessage
        fields = ("id", "name", "email", "subject", "message", "created_at")
        read_only_fields = ("id", "created_at")

    def validate_message(self, value: str) -> str:
        # A minimum length filters out the empty-ish submissions a single
        # required-field check lets through (" ", "hi"). Cheap, and it keeps the
        # admin inbox readable.
        if len(value.strip()) < 10:
            raise serializers.ValidationError(
                "Please give us a little more detail (at least 10 characters)."
            )
        return value.strip()
