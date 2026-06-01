from typing import List, Optional
from uuid import UUID

from app.dependencies import auth as deps
from app.db.session import get_db
from app.models.admin import AdminUser
from app.models.bill import Bill
from app.schemas.bill import Bill as BillSchema
from app.schemas.bill import PendingBillsResponse
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()


@router.get("/", response_model=List[BillSchema])
async def list_bills(
    academic_year: Optional[str] = None,
    status: Optional[str] = None,
    user_id: Optional[str] = None,
    student_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    admin: AdminUser = Depends(deps.get_current_admin),
):
    query = select(Bill)
    filters = [Bill.bill_type == "ACADEMIC"]
    if academic_year:
        filters.append(Bill.academic_year == academic_year)
    if status:
        filters.append(Bill.status == status)

    uid = user_id or student_id
    if uid:
        filters.append(Bill.user_id == uid)

    if filters:
        query = query.where(and_(*filters))

    query = query.order_by(Bill.created_at.desc())
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/pending", response_model=PendingBillsResponse)
async def get_pending_bills(
    user_id: Optional[str] = None,
    student_id: Optional[str] = None,
    academic_year: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    query = select(Bill).where(Bill.status == "UNPAID")
    uid = user_id or student_id
    if uid:
        query = query.where(Bill.user_id == uid)
    if academic_year:
        query = query.where(Bill.academic_year == academic_year)

    query = query.order_by(Bill.installment_number.asc(), Bill.created_at.asc())
    result = await db.execute(query)
    bills = result.scalars().all()

    total_pending = sum(float(b.amount) for b in bills)
    return {"bills": bills, "total_pending": total_pending, "count": len(bills)}


@router.get("/user/{user_id}", response_model=List[BillSchema])
async def get_user_bills(user_id: str, db: AsyncSession = Depends(get_db)):
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

    # Now find all bills that match any of those IDs or Emails
    # This ensures that brochure bills (which might only have user_id) are found
    # when searching by an email that is linked to that user_id in an academic bill.
    result = await db.execute(
        select(Bill)
        .where(or_(Bill.user_id.in_(user_ids), Bill.user_email.in_(user_emails)))
        .order_by(
            Bill.academic_year.desc(),
            Bill.installment_number.asc(),
            Bill.created_at.desc(),
        )
    )
    return result.scalars().all()


@router.get("/{bill_id}", response_model=BillSchema)
async def get_bill(bill_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Bill).where(Bill.bill_id == bill_id))
    bill = result.scalar_one_or_none()
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")
    return bill
