from abc import ABC, abstractmethod


class StorageBackend(ABC):

    @abstractmethod
    def upload(self, file_data, filename, content_type):
        """Upload a file and return its public URL."""
        pass

    @abstractmethod
    def delete(self, filename):
        """Delete a file by its filename/key."""
        pass

    @abstractmethod
    def public_url(self, filename):
        """Public URL of a stored file, without touching the backend."""
        pass

    @abstractmethod
    def presigned_post(self, filename, content_type, max_bytes, expires_in=600):
        """Credentials for a browser to upload straight to the backend.

        Returns {'url': ..., 'fields': {...}}. The upload is pinned to one key,
        one content type and a size range, so the signature is useless for
        anything else.
        """
        pass

    @abstractmethod
    def presigned_get(self, filename, expires_in=3600):
        """Temporary URL to read a private file."""
        pass

    @abstractmethod
    def head(self, filename):
        """Real size and content type of a stored file, or None if it is not there."""
        pass

    @abstractmethod
    def copy(self, source, destination):
        """Copy a stored file to another key, keeping its content type."""
        pass
