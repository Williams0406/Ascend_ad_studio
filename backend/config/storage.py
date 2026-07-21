from io import BytesIO
from pathlib import Path
from urllib.parse import urljoin

import cloudinary.uploader
import cloudinary.utils
import requests
from django.core.files.base import File
from django.core.files.storage import Storage
from django.conf import settings
from django.utils.encoding import filepath_to_uri


class CloudinaryMediaStorage(Storage):
    """Store uploaded and generated media in Cloudinary."""

    folder = "ascend"

    def _save(self, name, content):
        content.seek(0)
        result = cloudinary.uploader.upload(
            content,
            folder=self.folder,
            resource_type="auto",
            use_filename=False,
            unique_filename=True,
            overwrite=False,
        )
        return "|".join(
            (
                result.get("resource_type", "image"),
                result["public_id"],
                result.get("format", ""),
            )
        )

    def _open(self, name, mode="rb"):
        if "r" not in mode:
            raise ValueError("CloudinaryMediaStorage solo admite apertura de lectura.")
        if not self._is_cloudinary_name(name) and not str(name).startswith(("http://", "https://")):
            path = self._legacy_path(name)
            return File(path.open("rb"), name=name)
        response = requests.get(self.url(name), timeout=60)
        response.raise_for_status()
        return File(BytesIO(response.content), name=name)

    def delete(self, name):
        if not name:
            return
        if not self._is_cloudinary_name(name):
            if not str(name).startswith(("http://", "https://")):
                self._legacy_path(name).unlink(missing_ok=True)
            return
        resource_type, public_id, _ = self._parts(name)
        cloudinary.uploader.destroy(
            public_id,
            resource_type=resource_type,
            invalidate=True,
        )

    def exists(self, name):
        if not self._is_cloudinary_name(name):
            return self._legacy_path(name).exists()
        return False

    def size(self, name):
        if not self._is_cloudinary_name(name) and not str(name).startswith(("http://", "https://")):
            return self._legacy_path(name).stat().st_size
        response = requests.head(self.url(name), timeout=30)
        response.raise_for_status()
        return int(response.headers.get("content-length", 0))

    def url(self, name):
        if str(name).startswith(("http://", "https://")):
            return str(name)
        if not self._is_cloudinary_name(name):
            return urljoin(settings.MEDIA_URL, filepath_to_uri(str(name)))
        resource_type, public_id, file_format = self._parts(name)
        url, _ = cloudinary.utils.cloudinary_url(
            public_id,
            resource_type=resource_type,
            format=file_format or None,
            secure=True,
        )
        return url

    @staticmethod
    def _parts(name):
        parts = str(name).split("|", 2)
        if len(parts) != 3:
            raise ValueError("Identificador de archivo Cloudinary inválido.")
        return parts

    @staticmethod
    def _is_cloudinary_name(name):
        return str(name).count("|") == 2

    @staticmethod
    def _legacy_path(name):
        media_root = Path(settings.MEDIA_ROOT).resolve()
        path = (media_root / str(name)).resolve()
        if media_root not in path.parents and path != media_root:
            raise ValueError("Ruta de archivo local inválida.")
        return path
