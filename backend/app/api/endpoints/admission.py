from datetime import datetime
from typing import Optional

from app.core.config import settings
from app.db.session import get_db
from app.models.bill import Bill
from app.services import audit_service, notification_service
from dateutil.relativedelta import relativedelta
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from fastapi.responses import RedirectResponse
from pydantic import AliasChoices, BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()


class BrochurePaymentRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    user_id: str = Field(..., validation_alias=AliasChoices("user_id", "student_id"))
    brochure_id: str
    brochure_fee_amount: float
    academic_year: str


class StudentAdmissionRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    user_id: str = Field(..., validation_alias=AliasChoices("user_id", "student_id"))
    academic_year: str
    program_name: str
    total_course_fees: float
    installments: int
    user_name: Optional[str] = None
    user_email: Optional[str] = None
    user_class: Optional[str] = None


@router.get("/pay-brochure")
async def pay_brochure_auto_redirect(
    user_id: Optional[str] = None,
    student_id: Optional[str] = None,
    amount: float = 0.0,
    academic_year: str = "2025-26",
    db: AsyncSession = Depends(get_db),
):
    uid = user_id or student_id
    if not uid:
        raise HTTPException(status_code=400, detail="user_id or student_id is required")

    """GET version: Instantly redirects the browser."""
    result = await db.execute(
        select(Bill).where(
            Bill.user_id == uid,
            Bill.bill_type == "BROCHURE",
            Bill.academic_year == academic_year,
        )
    )
    existing = result.scalar_one_or_none()

    if existing:
        bill_id = existing.bill_id
    else:
        bill = Bill(
            user_id=user_id,
            academic_year=academic_year,
            program_name="Brochure",
            bill_type="BROCHURE",
            amount=amount,
            status="UNPAID",
        )
        db.add(bill)
        await db.flush()
        bill_id = bill.bill_id

    redirect_url = (
        f"{settings.FRONTEND_URL}/pay/brochure?bill_id={bill_id}&user_id={uid}"
    )
    return RedirectResponse(url=redirect_url)


@router.post("/brochure-payment")
async def create_brochure_bill(
    req: BrochurePaymentRequest, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Bill).where(
            Bill.user_id == req.user_id,
            Bill.bill_type == "BROCHURE",
            Bill.academic_year == req.academic_year,
        )
    )
    existing = result.scalar_one_or_none()

    if existing:
        bill_id = str(existing.bill_id)
        user_id = str(existing.user_id)
    else:
        bill = Bill(
            user_id=req.user_id,
            academic_year=req.academic_year,
            program_name="Brochure",
            bill_type="BROCHURE",
            amount=req.brochure_fee_amount,
            status="UNPAID",
        )
        db.add(bill)
        await db.flush()
        bill_id = str(bill.bill_id)
        user_id = str(bill.user_id)

    redirect_url = (
        f"{settings.FRONTEND_URL}/pay/brochure?bill_id={bill_id}&user_id={user_id}"
    )

    return {
        "status": "success",
        "bill_id": bill_id,
        "user_id": user_id,
        "brochure_id": req.brochure_id,
        "academic_year": req.academic_year,
        "amount": req.brochure_fee_amount,
        "redirect_url": redirect_url,
    }


@router.post("/brochures/request")
async def brochures_request_alias(
    req: BrochurePaymentRequest, db: AsyncSession = Depends(get_db)
):
    """Alias for brochure-payment to match Admission Module's expected URL."""
    return await create_brochure_bill(req, db)


@router.post("/generate-bills")
async def generate_student_bills(
    req: StudentAdmissionRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    if req.installments < 1:
        raise HTTPException(status_code=400, detail="Installments must be at least 1")

    # Check for existing
    result = await db.execute(
        select(Bill)
        .where(
            Bill.user_id == req.user_id,
            Bill.bill_type == "ACADEMIC",
            Bill.academic_year == req.academic_year,
        )
        .order_by(Bill.installment_number)
    )
    existing_bills = result.scalars().all()
    if existing_bills:
        return {
            "total_fees": req.total_course_fees,
            "installments": len(existing_bills),
            "per_installment": float(existing_bills[0].amount),
            "bills": [
                {
                    "bill_id": str(b.bill_id),
                    "amount": float(b.amount),
                    "status": b.status,
                    "installment_number": b.installment_number,
                }
                for b in existing_bills
            ],
            "message": "Existing academic bills found and returned.",
            "redirect_url": f"{settings.FRONTEND_URL}/user?user_id={req.user_id}",
        }

    per_installment = round(req.total_course_fees / req.installments, 2)
    remainder = round(req.total_course_fees - (per_installment * req.installments), 2)

    bills = []
    for i in range(1, req.installments + 1):
        amt = per_installment
        if i == req.installments and remainder != 0:
            amt = per_installment + remainder

        due_date = datetime.now() + relativedelta(months=3 * (i - 1))

        bill = Bill(
            user_id=req.user_id,
            academic_year=req.academic_year,
            user_name=req.user_name or "New Student",
            user_email=req.user_email or "",
            program_name=req.program_name,
            user_class=req.user_class or "N/A",
            bill_type="ACADEMIC",
            amount=amt,
            status="UNPAID",
            installment_number=i,
            total_installments=req.installments,
            due_date=due_date,
        )
        db.add(bill)
        bills.append(bill)

    await db.flush()

    # Trigger notification
    background_tasks.add_task(
        notification_service.notify_bill_generated,
        req.user_name or "Student",
        req.total_course_fees,
        req.installments,
        req.user_id,
        req.user_email,
    )

    await audit_service.log_event(
        "BILLS_GENERATED",
        "SUCCESS",
        f"Generated {req.installments} academic bill(s) for user {req.user_id}",
        {
            "user_id": req.user_id,
            "total_fees": req.total_course_fees,
            "installments": req.installments,
            "user_name": req.user_name,
        },
        db=db,
    )

    redirect_url = f"{settings.FRONTEND_URL}/user?user_id={req.user_id}"

    return {
        "total_fees": req.total_course_fees,
        "installments": req.installments,
        "per_installment": per_installment,
        "bills": [
            {
                "bill_id": str(b.bill_id),
                "amount": float(b.amount),
                "status": b.status,
                "installment_number": b.installment_number,
            }
            for b in bills
        ],
        "redirect_url": redirect_url,
    }
