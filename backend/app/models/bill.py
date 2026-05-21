import uuid

from app.db.base_class import Base
from sqlalchemy import Column, DateTime, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func


class Bill(Base):
    __tablename__ = "bills"

    bill_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(Text, nullable=False, index=True)
    academic_year = Column(String(20), nullable=False, index=True)
    user_name = Column(String(255))
    user_email = Column(String(255))
    program_name = Column(String(255))
    user_class = Column(String(50))
    bill_type = Column(String(50), nullable=False, server_default="ACADEMIC")
    amount = Column(Numeric(12, 2), nullable=False)
    status = Column(String(20), nullable=False, server_default="UNPAID", index=True)
    installment_number = Column(Integer)
    total_installments = Column(Integer)
    due_date = Column(DateTime(timezone=True), index=True)
    paid_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
