from rest_framework import generics, permissions, throttling

from .models import ContactMessage
from .serializers import ContactMessageSerializer


class ContactMessageThrottle(throttling.AnonRateThrottle):
    """
    Any unauthenticated, world-writable endpoint is a spam target. Throttling by
    IP is the minimum defence; without it a script can fill the database from a
    single machine in seconds.
    """

    scope = "contact"
    rate = "5/hour"


class ContactMessageCreateView(generics.CreateAPIView):
    """POST /api/contact/ -- public enquiry form. Write-only by design."""

    queryset = ContactMessage.objects.all()
    serializer_class = ContactMessageSerializer
    permission_classes = [permissions.AllowAny]
    throttle_classes = [ContactMessageThrottle]

    def perform_create(self, serializer):
        # Attribute the message to the sender when we know who they are, while
        # still accepting anonymous enquiries.
        user = self.request.user if self.request.user.is_authenticated else None
        serializer.save(user=user)
