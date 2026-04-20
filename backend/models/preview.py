from pydantic import BaseModel

from models.document import Change


class PreviewPdfRequest(BaseModel):
    changes: list[Change]
