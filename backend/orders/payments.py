"""
Demonstration card authorisation.

This is a replica of a Stripe-style card form, not a payment processor.
Nothing here talks to a bank. Full PAN is never stored, logged, or returned.
"""

from __future__ import annotations

import re
import secrets
from datetime import date
from decimal import Decimal

from rest_framework.exceptions import APIException

DEPOSIT_RATE = Decimal("0.10")

# Stripe's published test pans, used so the replica feels like their docs.
PAN_SUCCESS = "4242424242424242"
PAN_DECLINED = "4000000000000002"
PAN_INSUFFICIENT = "4000000000009995"


class PaymentDeclined(APIException):
    status_code = 402
    default_detail = "The bank declined this card."
    default_code = "card_declined"


class CardError(ValueError):
    """Validation failure (bad number, expired) — not a bank decline."""


def _digits(number: str) -> str:
    return re.sub(r"\D", "", number or "")


def luhn_ok(pan: str) -> bool:
    if not pan.isdigit() or len(pan) < 13 or len(pan) > 19:
        return False
    total = 0
    reverse = pan[::-1]
    for i, ch in enumerate(reverse):
        n = int(ch)
        if i % 2 == 1:
            n *= 2
            if n > 9:
                n -= 9
        total += n
    return total % 10 == 0


def brand_for(pan: str) -> str:
    if pan.startswith("4"):
        return "visa"
    if pan[:2] in {str(n) for n in range(51, 56)} or pan.startswith("2"):
        return "mastercard"
    if pan.startswith(("34", "37")):
        return "amex"
    return "card"


def deposit_for(total: Decimal) -> Decimal:
    return (total * DEPOSIT_RATE).quantize(Decimal("0.01"))


def authorize_demo_card(
    *,
    number: str,
    exp_month: int,
    exp_year: int,
    cvc: str,
    name: str,
) -> dict:
    """
    Validate the replica card and return a storeable snapshot.

    Raises CardError for form problems, PaymentDeclined for the demo decline pans.
    """
    pan = _digits(number)
    cvc_digits = _digits(cvc)
    holder = (name or "").strip()

    if not holder:
        raise CardError("Name on card is required.")
    if not luhn_ok(pan):
        raise CardError("Check the card number.")
    if not (1 <= int(exp_month) <= 12):
        raise CardError("Check the expiry month.")
    if int(exp_year) < date.today().year:
        raise CardError("That card has expired.")
    if len(cvc_digits) < 3 or len(cvc_digits) > 4:
        raise CardError("Check the security code.")

    if pan in {PAN_DECLINED, PAN_INSUFFICIENT}:
        raise PaymentDeclined(
            detail="The bank declined this card. Try the demonstration Visa 4242 4242 4242 4242."
        )

    return {
        "brand": brand_for(pan),
        "last4": pan[-4:],
        "reference": f"pi_demo_{secrets.token_hex(8)}",
    }
