from pydantic import BaseModel

from models.document import Change


class ExportRequest(BaseModel):
    doc_id: str
    changes: list[Change]
