from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import adaptive
from ..database import get_db
from ..deps import get_registration_by_magic
from ..models import Registration, SessionStatus, Test, TestSession, TestStatus
from ..scoring import (
    auto_category_scores,
    final_difficulty,
    grand_total,
    manual_score,
)
from ..schemas import (
    AnswerSubmit,
    ScoreBreakdown,
    SessionState,
    StorySubmit,
)

router = APIRouter(prefix="/api/session", tags=["student"])


def _get_session(db: Session, reg: Registration) -> TestSession:
    if reg.session is None:
        # Created at release; if missing, create lazily.
        session = TestSession(registration_id=reg.id, test_id=reg.test_id)
        db.add(session)
        db.commit()
        db.refresh(session)
        return session
    return reg.session


@router.get("/info")
def session_info(reg: Registration = Depends(get_registration_by_magic), db: Session = Depends(get_db)):
    test = db.get(Test, reg.test_id)
    session = _get_session(db, reg)
    return {
        "first_name": reg.first_name,
        "last_name": reg.last_name,
        "test_name": test.name if test else "",
        "test_released": test.status == TestStatus.released.value if test else False,
        "session_status": session.status,
        "scores_released": test.scores_released if test else False,
    }


@router.post("/start", response_model=SessionState)
def start(reg: Registration = Depends(get_registration_by_magic), db: Session = Depends(get_db)):
    test = db.get(Test, reg.test_id)
    if test is None or test.status != TestStatus.released.value:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "The test has not been released yet.")
    session = _get_session(db, reg)
    if session.status in (SessionStatus.completed.value, SessionStatus.timed_out.value):
        return adaptive.render_state(session)
    adaptive.start_or_resume(db, session)
    return adaptive.render_state(session)


@router.get("/state", response_model=SessionState)
def state(reg: Registration = Depends(get_registration_by_magic), db: Session = Depends(get_db)):
    session = _get_session(db, reg)
    if session.status == SessionStatus.in_progress.value:
        adaptive.refresh_state(db, session)
    return adaptive.render_state(session)


@router.post("/answer", response_model=SessionState)
def answer(
    payload: AnswerSubmit,
    reg: Registration = Depends(get_registration_by_magic),
    db: Session = Depends(get_db),
):
    session = _get_session(db, reg)
    try:
        adaptive.submit_answer(db, session, payload.assignment_id, payload.selected_option)
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc))
    return adaptive.render_state(session)


@router.post("/finish-comprehension", response_model=SessionState)
def finish_comprehension(
    reg: Registration = Depends(get_registration_by_magic), db: Session = Depends(get_db)
):
    session = _get_session(db, reg)
    adaptive.finish_comprehension(db, session)
    return adaptive.render_state(session)


@router.post("/story", response_model=SessionState)
def story(
    payload: StorySubmit,
    reg: Registration = Depends(get_registration_by_magic),
    db: Session = Depends(get_db),
):
    session = _get_session(db, reg)
    adaptive.save_story(db, session, payload.prompt_id, payload.answer_text, payload.final)
    return adaptive.render_state(session)


@router.post("/flag")
def flag_focus_loss(
    reg: Registration = Depends(get_registration_by_magic), db: Session = Depends(get_db)
):
    """Record that the student left the test tab/window (anti-cheating audit)."""
    session = _get_session(db, reg)
    if session.status == SessionStatus.in_progress.value:
        session.focus_loss_count = (session.focus_loss_count or 0) + 1
        db.commit()
        db.refresh(session)
    return {"focus_loss_count": session.focus_loss_count}


@router.get("/score", response_model=ScoreBreakdown)
def score(reg: Registration = Depends(get_registration_by_magic), db: Session = Depends(get_db)):
    test = db.get(Test, reg.test_id)
    session = _get_session(db, reg)
    released = bool(test and test.scores_released)
    cat_scores = auto_category_scores(session)
    return ScoreBreakdown(
        released=released,
        first_name=reg.first_name,
        category_scores={
            "Category 1 (Alphabets)": cat_scores.get(1, 0),
            "Category 2 (Grammar)": cat_scores.get(2, 0),
            "Category 3 (Translation)": cat_scores.get(3, 0),
            "Category 4 (Comprehension)": cat_scores.get(4, 0),
        }
        if released
        else {},
        cat5_score=manual_score(session, 5) if released else None,
        cat6_score=manual_score(session, 6) if released else None,
        auto_total=sum(cat_scores.values()) if released else 0,
        grand_total=grand_total(session) if released else None,
        final_difficulty=final_difficulty(session) if released else None,
    )
