from datetime import datetime
from typing import Any, Optional

# pyrefly: ignore [missing-import]
from pydantic import BaseModel, ConfigDict


class AuditLogBase(BaseModel):
    event_name: str
    status: str
    description: Optional[str] = None
    log_metadata: Optional[Any] = None


class AuditLog(AuditLogBase):
    log_id: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
