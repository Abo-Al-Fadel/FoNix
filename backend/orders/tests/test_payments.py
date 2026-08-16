from decimal import Decimal

from django.test import SimpleTestCase

from orders.payments import CardError, PaymentDeclined, authorize_demo_card, deposit_for, luhn_ok


class DemoCardTests(SimpleTestCase):
    def test_luhn_accepts_the_stripe_success_pan(self):
        self.assertTrue(luhn_ok("4242424242424242"))

    def test_luhn_rejects_a_bad_number(self):
        self.assertFalse(luhn_ok("4242424242424243"))

    def test_deposit_is_ten_percent(self):
        self.assertEqual(deposit_for(Decimal("2400000.00")), Decimal("240000.00"))

    def test_the_success_pan_authorises(self):
        snapshot = authorize_demo_card(
            number="4242 4242 4242 4242",
            exp_month=12,
            exp_year=2030,
            cvc="123",
            name="Ada Lovelace",
        )
        self.assertEqual(snapshot["last4"], "4242")
        self.assertEqual(snapshot["brand"], "visa")
        self.assertTrue(snapshot["reference"].startswith("pi_demo_"))

    def test_the_decline_pan_raises_402(self):
        with self.assertRaises(PaymentDeclined):
            authorize_demo_card(
                number="4000000000000002",
                exp_month=12,
                exp_year=2030,
                cvc="123",
                name="Ada Lovelace",
            )

    def test_a_bad_number_is_a_form_error_not_a_decline(self):
        with self.assertRaises(CardError):
            authorize_demo_card(
                number="1234",
                exp_month=12,
                exp_year=2030,
                cvc="123",
                name="Ada Lovelace",
            )
