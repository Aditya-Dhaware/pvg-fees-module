from typing import List, Optional
from uuid import UUID

from app.dependencies import auth as deps
from app.db.session import get_db
from app.models.admin import AdminUser
from app.models.bill import Bill
from app.models.receipt import Receipt
from app.schemas.receipt import Receipt as ReceiptSchema
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()


@router.get("/", response_model=List[ReceiptSchema])
async def list_receipts(
    academic_year: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    admin: AdminUser = Depends(deps.get_current_admin),
):
    query = select(
        Receipt,
        Bill.program_name,
        Bill.academic_year,
        Bill.user_name,
        Bill.user_class,
        Bill.bill_type,
        Bill.installment_number,
        Bill.total_installments,
    ).outerjoin(Bill, Receipt.bill_id == Bill.bill_id)

    if academic_year:
        query = query.where(Bill.academic_year == academic_year)

    query = query.order_by(Receipt.created_at.desc())
    result = await db.execute(query)

    receipts = []
    for row in result.all():
        r = row.Receipt
        r.program_name = row.program_name
        r.academic_year = row.academic_year
        r.user_name = row.user_name
        r.user_class = row.user_class
        r.bill_type = row.bill_type

        r.installment_number = row.installment_number
        r.total_installments = row.total_installments
        receipts.append(r)

    return receipts


@router.get("/user/{user_id}", response_model=List[ReceiptSchema])
async def get_user_receipts(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    payload: dict = Depends(deps.get_current_user_payload),
):
    deps.check_user_permission(user_id, payload)

    # First, find all unique User IDs and Emails associated with the search term
    # This "links" the identities (e.g., finding the Student ID from an Email)
    identity_query = select(Bill.user_id, Bill.user_email).where(
        or_(Bill.user_id == user_id, Bill.user_email == user_id)
    )
    identity_result = await db.execute(identity_query)
    identities = identity_result.all()

    if not identities:
        return []

    user_ids = {i.user_id for i in identities if i.user_id}
    user_emails = {i.user_email for i in identities if i.user_email}

    query = (
        select(
            Receipt,
            Bill.program_name,
            Bill.academic_year,
            Bill.user_name,
            Bill.user_class,
            Bill.bill_type,
            Bill.installment_number,
            Bill.total_installments,
        )
        .outerjoin(Bill, Receipt.bill_id == Bill.bill_id)
        .where(or_(Receipt.user_id.in_(user_ids), Bill.user_email.in_(user_emails)))
        .order_by(Receipt.created_at.desc())
    )

    result = await db.execute(query)

    receipts = []
    for row in result.all():
        r = row.Receipt
        r.program_name = row.program_name
        r.academic_year = row.academic_year
        r.user_name = row.user_name
        r.user_class = row.user_class
        r.bill_type = row.bill_type

        r.installment_number = row.installment_number
        r.total_installments = row.total_installments
        receipts.append(r)

    return receipts


@router.get("/{receipt_id}", response_model=ReceiptSchema)
async def get_receipt(
    receipt_id: UUID,
    db: AsyncSession = Depends(get_db),
    payload: dict = Depends(deps.get_current_user_payload),
):
    query = (
        select(
            Receipt,
            Bill.program_name,
            Bill.academic_year,
            Bill.user_name,
            Bill.user_class,
            Bill.bill_type,
            Bill.installment_number,
            Bill.total_installments,
        )
        .outerjoin(Bill, Receipt.bill_id == Bill.bill_id)
        .where(Receipt.receipt_id == receipt_id)
    )

    result = await db.execute(query)
    row = result.first()

    if not row:
        raise HTTPException(status_code=404, detail="Receipt not found")

    deps.check_user_permission(row.Receipt.user_id, payload)

    r = row.Receipt
    r.program_name = row.program_name
    r.academic_year = row.academic_year
    r.user_name = row.user_name
    r.user_class = row.user_class
    r.bill_type = row.bill_type
    r.installment_number = row.installment_number
    r.total_installments = row.total_installments

    return r
