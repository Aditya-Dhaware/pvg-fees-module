from datetime import datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class RefundBase(BaseModel):
    payment_id: UUID
    user_id: str
    amount: Decimal
    reason: Optional[str] = None
    status: str = "PENDING"


class Refund(RefundBase):
    refund_id: UUID
    created_at: datetime

    # Extra fields for UI from joined Bill
    program_name: Optional[str] = None
    academic_year: Optional[str] = None
    bill_type: Optional[str] = None
    razorpay_refund_id: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class CreateRefundRequest(BaseModel):
    payment_id: UUID
    amount: Decimal
    reason: str


class UpdateRefundStatusRequest(BaseModel):
    status: str
