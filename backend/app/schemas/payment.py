from datetime import datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class PaymentBase(BaseModel):
    bill_id: UUID
    user_id: str
    amount: Decimal
    status: str = "PENDING"


class PaymentCreate(PaymentBase):
    razorpay_order_id: str


class Payment(PaymentBase):
    payment_id: UUID
    razorpay_order_id: Optional[str] = None
    razorpay_payment_id: Optional[str] = None
    razorpay_signature: Optional[str] = None
    created_at: datetime

    # Extra fields for UI from joined Bill
    program_name: Optional[str] = None
    academic_year: Optional[str] = None
    bill_type: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class VerifyPaymentRequest(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
