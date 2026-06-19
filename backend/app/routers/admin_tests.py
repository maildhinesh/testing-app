from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..deps import get_current_admin
from ..email_service import send_magic_link_email, send_scores_email
from ..models import (
    Admin,
    Registration,
    RegistrationStatus,
    SessionStatus,
    Test,
    TestSession,
    TestStatus,
)
from ..schemas import TestCreate, TestOut, TestStats, TestUpdate
from ..security import generate_token, utcnow

router = APIRouter(prefix="/api/admin/tests", tags=["admin-tests"])


def _get_test(db: Session, test_id: int) -> Test:
    test = db.get(Test, test_id)
    if test is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Test not found")
    return test


def _stats(db: Session, test: Test) -> TestStats:
    regs = db.query(Registration).filter(Registration.test_id == test.id).all()
    reg_ids = [r.id for r in regs]
    sessions = (
        db.query(TestSession).filter(TestSession.registration_id.in_(reg_ids)).all()
        if reg_ids
        else []
    )

    def count(s: str) -> int:
        return sum(1 for r in regs if r.status == s)

    return TestStats(
        test=TestOut.model_validate(test),
        total_registrations=len(regs),
        pending_email=count(RegistrationStatus.pending_email.value),
        awaiting_approval=count(RegistrationStatus.email_verified.value),
        approved=count(RegistrationStatus.approved.value),
        rejected=count(RegistrationStatus.rejected.value),
        sessions_started=sum(
            1 for s in sessions if s.status != SessionStatus.not_started.value
        ),
        sessions_completed=sum(
            1
            for s in sessions
            if s.status in (SessionStatus.completed.value, SessionStatus.timed_out.value)
        ),
    )


@router.get("", response_model=list[TestStats])
def list_tests(db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    tests = db.query(Test).order_by(Test.created_at.desc()).all()
    return [_stats(db, t) for t in tests]


@router.post("", response_model=TestOut, status_code=status.HTTP_201_CREATED)
def create_test(
    payload: TestCreate, db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)
):
    test = Test(
        name=payload.name,
        description=payload.description,
        scheduled_date=payload.scheduled_date,
        status=TestStatus.scheduled.value if payload.scheduled_date else TestStatus.draft.value,
    )
    db.add(test)
    db.commit()
    db.refresh(test)
    return test


@router.get("/{test_id}", response_model=TestStats)
def get_test(test_id: int, db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    return _stats(db, _get_test(db, test_id))


@router.patch("/{test_id}", response_model=TestOut)
def update_test(
    test_id: int,
    payload: TestUpdate,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    test = _get_test(db, test_id)
    data = payload.model_dump(exclude_unset=True)
    if "status" in data and data["status"] not in {s.value for s in TestStatus}:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid status")
    for key, value in data.items():
        setattr(test, key, value)
    db.commit()
    db.refresh(test)
    return test


@router.post("/{test_id}/release", response_model=TestStats)
def release_test(
    test_id: int, db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)
):
    """Release the test to all approved registrants: generate magic links and email them."""
    test = _get_test(db, test_id)
    approved = (
        db.query(Registration)
        .filter(
            Registration.test_id == test_id,
            Registration.status == RegistrationStatus.approved.value,
        )
        .all()
    )
    if not approved:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "No approved registrations to release the test to."
        )

    test.status = TestStatus.released.value
    expires = utcnow() + timedelta(minutes=settings.magic_link_expire_minutes)
    for reg in approved:
        if not reg.magic_token:
            reg.magic_token = generate_token()
        reg.magic_token_expires = expires
        if reg.session is None:
            db.add(
                TestSession(
                    registration_id=reg.id,
                    test_id=test_id,
                    status=SessionStatus.not_started.value,
                )
            )
    db.commit()

    for reg in approved:
        send_magic_link_email(reg.email, reg.first_name, reg.magic_token, test.name)

    return _stats(db, test)


@router.post("/{test_id}/release-scores", response_model=TestStats)
def release_scores(
    test_id: int, db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)
):
    test = _get_test(db, test_id)
    test.scores_released = True
    db.commit()

    approved = (
        db.query(Registration)
        .filter(
            Registration.test_id == test_id,
            Registration.status == RegistrationStatus.approved.value,
            Registration.magic_token.isnot(None),
        )
        .all()
    )
    for reg in approved:
        send_scores_email(reg.email, reg.first_name, reg.magic_token, test.name)

    return _stats(db, test)
