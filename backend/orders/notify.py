import logging

from django.conf import settings
from django.core.mail import send_mail

logger = logging.getLogger(__name__)


def _send(subject: str, body: str, to: str) -> None:
    try:
        send_mail(
            subject,
            body,
            settings.DEFAULT_FROM_EMAIL,
            [to],
            fail_silently=False,
        )
    except Exception:
        logger.exception("Order email failed")


def notify_order_placed(order) -> None:
    deposit = ""
    if order.payment_status == order.PaymentStatus.AUTHORIZED:
        deposit = (
            f"A demonstration reservation of £{order.deposit_amount} was "
            f"authorised on {order.payment_brand} ····{order.payment_last4}. "
            "No money was taken.\n\n"
        )
    _send(
        f"FoNix allocation #{order.pk}",
        (
            f"We have recorded allocation #{order.pk} as pending.\n\n"
            f"{deposit}"
            "You can cancel it from your account while it is still pending. "
            "Once FoNix confirms it, only the hangar can unwind it.\n"
        ),
        order.user.email,
    )


def notify_order_status(order, event) -> None:
    _send(
        f"FoNix allocation #{order.pk}: {order.get_status_display()}",
        (
            f"Allocation #{order.pk} is now {order.get_status_display()}.\n"
            f"{event.note}\n"
        ),
        order.user.email,
    )
