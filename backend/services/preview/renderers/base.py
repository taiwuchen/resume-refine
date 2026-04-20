from abc import ABC, abstractmethod
from pathlib import Path


class PreviewRenderer(ABC):
    @abstractmethod
    def render(self, input_path: Path, output_path: Path) -> Path:
        """Render a preview artifact from the input DOCX."""
