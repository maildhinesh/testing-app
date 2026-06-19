from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..email_service import send_verification_email
from ..models import Registration, RegistrationStatus, Test, TestStatus
from ..schemas import RegistrationCreate, TestOut
from ..security import generate_token, utcnow

router = APIRouter(prefix="/api", tags=["public"])


@router.get("/tests/open", response_model=list[TestOut])
def list_open_tests(db: Session = Depends(get_db)):
    """Tests that are open for registration (anything not closed)."""
    tests = (
        db.query(Test)
        .filter(Test.status != TestStatus.closed.value)
        .order_by(Test.scheduled_date.is_(None), Test.scheduled_date)
        .all()
    )
    return tests


@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(payload: RegistrationCreate, db: Session = Depends(get_db)):
    test = db.get(Test, payload.test_id)
    if test is None or test.status == TestStatus.closed.value:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Test is not open for registration")

    email = payload.email.lower()
    existing = (
        db.query(Registration)
        .filter(Registration.test_id == payload.test_id, Registration.email == email)
        .first()
    )
    if existing is not None:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "This email is already registered for this test.",
        )

    token = generate_token()
    reg = Registration(
        test_id=payload.test_id,
        first_name=payload.first_name.strip(),
        last_name=payload.last_name.strip(),
        nilai=payload.nilai.strip(),
        email=email,
        status=RegistrationStatus.pending_email.value,
        email_verify_token=token,
        email_verify_expires=utcnow() + timedelta(minutes=settings.email_verify_expire_minutes),
    )
    db.add(reg)
    db.commit()

    send_verification_email(email, reg.first_name, token)
    return {
        "message": "Registration received. Please check your email to confirm your address.",
        "registration_id": reg.id,
    }


@router.get("/verify-email")
def verify_email(token: str, db: Session = Depends(get_db)):
    reg = db.query(Registration).filter(Registration.email_verify_token == token).first()
    if reg is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid verification link.")
    if reg.email_verify_expires and reg.email_verify_expires < utcnow():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This verification link has expired.")

    if reg.status == RegistrationStatus.pending_email.value:
        reg.status = RegistrationStatus.email_verified.value
        reg.email_verified_at = utcnow()
        reg.email_verify_token = None
        db.commit()

    return {
        "message": "Email verified! Your registration is now awaiting administrator approval.",
        "first_name": reg.first_name,
    }
