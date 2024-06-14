from abc import ABC, abstractmethod


class IndexInterface(ABC):
    @abstractmethod
    def index_exists(self):
        """Check if the index already exists."""
        pass

    @abstractmethod
    def build_index(self):
        """Build the index if it doesn't exist."""
        pass

    @abstractmethod
    def get_vectorstore(self):
        """Get the retriever based on the built index."""
        pass
