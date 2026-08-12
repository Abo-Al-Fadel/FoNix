import factory
from django.contrib.auth import get_user_model

User = get_user_model()

# Shared by the factories and by any test that needs to log in over the API.
# Deliberately not "password123" -- Django's CommonPasswordValidator rejects
# that, and a test fixture that the real validators would refuse is a test
# fixture that proves nothing about the real endpoint.
TEST_PASSWORD = "ignition-2049"


class UserFactory(factory.django.DjangoModelFactory):
    """
    Builds a customer account.

    Why factories instead of User.objects.create_user(...) in every test: a
    factory declares only the fields a given test cares about and fills the rest
    with valid data. When the model gains a required field, one file changes
    instead of thirty, and no test is coupled to data it never asserts on.
    """

    class Meta:
        model = User

    # Sequence guarantees uniqueness across every instance a test creates, so
    # two users in the same test never collide on the unique username/email.
    username = factory.Sequence(lambda n: f"driver{n}")
    email = factory.Sequence(lambda n: f"driver{n}@fonix.test")
    first_name = "Test"
    last_name = "Driver"
    role = User.Role.CUSTOMER
    password = TEST_PASSWORD

    @classmethod
    def _create(cls, model_class, *args, **kwargs):
        """
        Route creation through create_user() instead of the default
        Model.objects.create().

        This matters: create() would write the raw string "ignition-2049" into
        the password column. Every login test would then fail against a
        perfectly correct view, because check_password() compares a hash to
        plaintext. Using the manager means tests exercise the same code path
        registration does.
        """
        return model_class.objects.create_user(*args, **kwargs)


class AdminUserFactory(UserFactory):
    """A FoNix staff account -- the only kind that may mutate the catalog."""

    username = factory.Sequence(lambda n: f"staff{n}")
    email = factory.Sequence(lambda n: f"staff{n}@fonix.test")
    role = User.Role.ADMIN
    is_staff = True
