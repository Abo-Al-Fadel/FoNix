import shutil
import tempfile

from django.conf import settings
from django.test.runner import DiscoverRunner


class MediaIsolatedTestRunner(DiscoverRunner):
    """
    Runs the test suite with MEDIA_ROOT pointed at a throwaway directory.

    Several tests upload images (car thumbnails and gallery stills). Django
    writes those to MEDIA_ROOT for real -- so with the default settings, every
    test run would sprinkle files like `thumb_a8Fk2.png` into backend/media/
    and they would accumulate forever, mixed in with the genuine catalog
    images.

    Overriding it here rather than with @override_settings on each test class
    means it is impossible to forget on a test written next month, and
    `python manage.py test` stays the single command that runs everything.

    Wired up via TEST_RUNNER in config/settings/base.py.
    """

    def setup_test_environment(self, **kwargs):
        super().setup_test_environment(**kwargs)
        self._temp_media_root = tempfile.mkdtemp(prefix="fonix-test-media-")
        self._original_media_root = settings.MEDIA_ROOT
        settings.MEDIA_ROOT = self._temp_media_root

    def teardown_test_environment(self, **kwargs):
        settings.MEDIA_ROOT = self._original_media_root
        # ignore_errors because a Windows file handle held open by a failed test
        # should not turn a red test run into a confusing traceback about
        # cleanup.
        shutil.rmtree(self._temp_media_root, ignore_errors=True)
        super().teardown_test_environment(**kwargs)
