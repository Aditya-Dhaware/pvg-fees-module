from datetime import datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class ReceiptBase(BaseModel):
    payment_id: UUID
    bill_id: UUID
    user_id: str
    receipt_number: str
    amount: Decimal

    # Optional fields from joined Bill
    program_name: Optional[str] = None
    academic_year: Optional[str] = None
    user_name: Optional[str] = None
    user_class: Optional[str] = None
    bill_type: Optional[str] = None
    installment_number: Optional[int] = None
    total_installments: Optional[int] = None


class Receipt(ReceiptBase):
    receipt_id: UUID
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
