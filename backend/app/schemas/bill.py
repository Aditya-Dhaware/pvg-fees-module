from datetime import datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

# pyrefly: ignore [missing-import]
from pydantic import BaseModel, ConfigDict


class BillBase(BaseModel):
    user_id: str
    academic_year: str
    user_name: Optional[str] = None
    user_email: Optional[str] = None
    program_name: Optional[str] = None
    user_class: Optional[str] = None
    bill_type: str = "ACADEMIC"
    amount: Decimal
    status: str = "UNPAID"
    installment_number: Optional[int] = None
    total_installments: Optional[int] = None
    due_date: Optional[datetime] = None
    paid_at: Optional[datetime] = None


class BillCreate(BillBase):
    pass


class Bill(BillBase):
    bill_id: UUID
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PendingBillsResponse(BaseModel):
    bills: list[Bill]
    total_pending: float
    count: int
