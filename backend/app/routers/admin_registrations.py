from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_admin
from ..models import Admin, Registration, RegistrationStatus, Test
from ..schemas import AdminRegistrationCreate, RegistrationOut

router = APIRouter(prefix="/api/admin", tags=["admin-registrations"])


def _get_registration(db: Session, reg_id: int) -> Registration:
    reg = db.get(Registration, reg_id)
    if reg is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Registration not found")
    return reg


@router.get("/tests/{test_id}/registrations", response_model=list[RegistrationOut])
def list_registrations(
    test_id: int,
    reg_status: str | None = None,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    q = db.query(Registration).filter(Registration.test_id == test_id)
    if reg_status:
        q = q.filter(Registration.status == reg_status)
    return q.order_by(Registration.created_at).all()


@router.post(
    "/tests/{test_id}/registrations",
    response_model=RegistrationOut,
    status_code=status.HTTP_201_CREATED,
)
def manual_register(
    test_id: int,
    payload: AdminRegistrationCreate,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    test = db.get(Test, test_id)
    if test is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Test not found")
    email = payload.email.lower()
    existing = (
        db.query(Registration)
        .filter(Registration.test_id == test_id, Registration.email == email)
        .first()
    )
    if existing is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "This email is already registered.")
    reg = Registration(
        test_id=test_id,
        first_name=payload.first_name.strip(),
        last_name=payload.last_name.strip(),
        nilai=payload.nilai.strip(),
        email=email,
        status=RegistrationStatus.approved.value,  # admin-vouched, skips email verification
    )
    db.add(reg)
    db.commit()
    db.refresh(reg)
    return reg


@router.post("/registrations/{reg_id}/approve", response_model=RegistrationOut)
def approve(reg_id: int, db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    reg = _get_registration(db, reg_id)
    if reg.status == RegistrationStatus.pending_email.value:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "User has not verified their email yet."
        )
    reg.status = RegistrationStatus.approved.value
    db.commit()
    db.refresh(reg)
    return reg


@router.post("/registrations/{reg_id}/reject", response_model=RegistrationOut)
def reject(reg_id: int, db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    reg = _get_registration(db, reg_id)
    reg.status = RegistrationStatus.rejected.value
    reg.magic_token = None
    db.commit()
    db.refresh(reg)
    return reg
