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
