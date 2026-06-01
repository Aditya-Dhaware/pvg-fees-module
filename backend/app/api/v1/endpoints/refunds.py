import logging
from typing import List, Optional
from uuid import UUID

from app.dependencies import auth as deps
from app.db.session import get_db
from app.models.admin import AdminUser
from app.models.bill import Bill
from app.models.payment import Payment
from app.models.refund import Refund
from app.schemas.refund import CreateRefundRequest
from app.schemas.refund import Refund as RefundSchema
from app.schemas.refund import UpdateRefundStatusRequest
from app.services import audit_service, notification_service, razorpay_service
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/", response_model=RefundSchema)
async def create_refund(
    req: CreateRefundRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    admin: AdminUser = Depends(deps.get_current_admin),
):
    result = await db.execute(
        select(Payment, Bill)
        .join(Bill, Payment.bill_id == Bill.bill_id)
        .where(and_(Payment.payment_id == req.payment_id, Payment.status == "SUCCESS"))
    )
    row = result.first()

    if not row:
        raise HTTPException(status_code=404, detail="Successful payment not found")

    payment, bill = row

    if req.amount > payment.amount:
        raise HTTPException(
            status_code=400, detail="Refund amount exceeds payment amount"
        )

    # Check existing refunds
    existing_result = await db.execute(
        select(func.coalesce(func.sum(Refund.amount), 0)).where(
            and_(Refund.payment_id == req.payment_id, Refund.status != "REJECTED")
        )
    )
    total_existing = existing_result.scalar()

    if total_existing + req.amount > payment.amount:
        raise HTTPException(
            status_code=400, detail="Total refunds would exceed payment amount"
        )

    refund = Refund(
        payment_id=req.payment_id,
        user_id=payment.user_id,
        amount=req.amount,
        reason=req.reason,
        status="PENDING",
    )
    db.add(refund)
    await db.flush()

    # Trigger notification
    background_tasks.add_task(
        notification_service.notify_refund_initialized,
        bill.user_name or "Student",
        float(req.amount),
        payment.user_id,
        bill.user_email,
    )

    await audit_service.log_event(
        "REFUND_CREATED",
        "SUCCESS",
        f"Refund request created for payment {req.payment_id}",
        {
            "payment_id": str(req.payment_id),
            "amount": float(req.amount),
            "reason": req.reason,
            "refund_id": str(refund.refund_id),
        },
        db=db,
    )
    return refund


@router.put("/{refund_id}", response_model=RefundSchema)
async def update_refund(
    refund_id: UUID,
    req: UpdateRefundStatusRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    admin: AdminUser = Depends(deps.get_current_admin),
):
    if req.status not in ("REFUNDED", "REJECTED"):
        raise HTTPException(
            status_code=400, detail="Status must be REFUNDED or REJECTED"
        )

    result = await db.execute(select(Refund).where(Refund.refund_id == refund_id))
    refund = result.scalar_one_or_none()

    if not refund:
        raise HTTPException(status_code=404, detail="Refund not found")

    if req.status == "REFUNDED" and refund.status != "REFUNDED":
        # Integrate Razorpay refund
        pay_result = await db.execute(
            select(Payment, Bill)
            .join(Bill, Payment.bill_id == Bill.bill_id)
            .where(Payment.payment_id == refund.payment_id)
        )
        row = pay_result.first()
        payment, bill = row if row else (None, None)

        if not payment or not payment.razorpay_payment_id:
            raise HTTPException(
                status_code=400,
                detail="Associated Razorpay payment not found or uncaptured",
            )

        try:
            client = razorpay_service.get_razorpay_client()
            rzp_refund = client.refund.create(
                {
                    "payment_id": payment.razorpay_payment_id,
                    "amount": int(round(float(refund.amount) * 100)),
                    "notes": {"reason": refund.reason},
                }
            )
            # Save the Razorpay refund ID
            refund.razorpay_refund_id = rzp_refund.get("id")

            # Trigger notification
            background_tasks.add_task(
                notification_service.notify_refund_completed,
                bill.user_name or "Student",
                float(refund.amount),
                refund.user_id,
                bill.user_email,
            )

        except Exception as e:
            error_msg = str(e)
            logger.error(f"Razorpay refund failed: {error_msg}")

            await audit_service.log_event(
                "REFUND_FAILED",
                "ERROR",
                f"Refund {refund_id} failed: {error_msg}",
                {
                    "refund_id": str(refund_id),
                    "payment_id": str(refund.payment_id),
                    "error": error_msg,
                },
                db=db,
            )

            raise HTTPException(
                status_code=400,
                detail=f"Razorpay refund failed: {error_msg}. Please check your Razorpay balance or payment ID.",
            )

    refund.status = req.status
    await db.flush()

    await audit_service.log_event(
        "REFUND_UPDATED",
        "SUCCESS",
        f"Refund {refund_id} status updated to {req.status}",
        {
            "refund_id": str(refund_id),
            "new_status": req.status,
            "amount": float(refund.amount),
        },
        db=db,
    )
    return refund


@router.get("/", response_model=List[RefundSchema])
async def list_refunds(
    academic_year: Optional[str] = None,
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    admin: AdminUser = Depends(deps.get_current_admin),
):
    # Join with bills to filter by academic_year
    query = (
        select(Refund, Bill.program_name, Bill.academic_year, Bill.bill_type)
        .outerjoin(Payment, Refund.payment_id == Payment.payment_id)
        .outerjoin(Bill, Payment.bill_id == Bill.bill_id)
    )

    if academic_year:
        query = query.where(Bill.academic_year == academic_year)
    if status:
        query = query.where(Refund.status == status)

    query = query.order_by(Refund.created_at.desc())
    result = await db.execute(query)

    refunds = []
    for row in result.all():
        r = row.Refund
        r.program_name = row.program_name
        r.academic_year = row.academic_year
        r.bill_type = row.bill_type
        refunds.append(r)

    return refunds


@router.get("/user/{user_id}", response_model=List[RefundSchema])
async def get_user_refunds(user_id: str, db: AsyncSession = Depends(get_db)):
    query = (
        select(Refund, Bill.program_name, Bill.academic_year, Bill.bill_type)
        .outerjoin(Payment, Refund.payment_id == Payment.payment_id)
        .outerjoin(Bill, Payment.bill_id == Bill.bill_id)
        .where(Refund.user_id == user_id)
        .order_by(Refund.created_at.desc())
    )

    result = await db.execute(query)

    refunds = []
    for row in result.all():
        r = row.Refund
        r.program_name = row.program_name
        r.academic_year = row.academic_year
        r.bill_type = row.bill_type
        refunds.append(r)

    return refunds
