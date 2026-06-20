from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_admin
from ..models import (
    Admin,
    ManualScore,
    Registration,
    SessionStatus,
    TestSession,
)
from ..scoring import (
    auto_total,
    final_difficulty,
    grand_total,
    manual_score,
)
from ..schemas import (
    ManualScoreIn,
    OptionView,
    ResponseDetail,
    SessionProgress,
    SessionResponses,
    StoryAnswerDetail,
)

router = APIRouter(prefix="/api/admin", tags=["admin-progress"])


@router.get("/tests/{test_id}/progress", response_model=list[SessionProgress])
def progress(test_id: int, db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    regs = (
        db.query(Registration)
        .filter(Registration.test_id == test_id)
        .order_by(Registration.last_name, Registration.first_name)
        .all()
    )
    out: list[SessionProgress] = []
    for reg in regs:
        s = reg.session
        if s is None:
            out.append(
                SessionProgress(
                    registration_id=reg.id,
                    session_id=None,
                    first_name=reg.first_name,
                    last_name=reg.last_name,
                    nilai=reg.nilai,
                    email=reg.email,
                    status=reg.status,
                    current_category=None,
                    current_difficulty=None,
                    final_difficulty=None,
                    auto_score=0,
                    cat5_score=None,
                    cat6_score=None,
                    total_score=None,
                    focus_loss_count=0,
                    started_at=None,
                    completed_at=None,
                )
            )
            continue
        out.append(
            SessionProgress(
                registration_id=reg.id,
                session_id=s.id,
                first_name=reg.first_name,
                last_name=reg.last_name,
                nilai=reg.nilai,
                email=reg.email,
                status=s.status,
                current_category=s.current_category,
                current_difficulty=s.current_difficulty,
                final_difficulty=final_difficulty(s),
                auto_score=auto_total(s),
                cat5_score=manual_score(s, 5),
                cat6_score=manual_score(s, 6),
                total_score=grand_total(s),
                focus_loss_count=s.focus_loss_count or 0,
                started_at=s.started_at,
                completed_at=s.completed_at,
            )
        )
    return out


@router.get("/sessions/{session_id}/responses", response_model=SessionResponses)
def session_responses(
    session_id: int, db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)
):
    """Everything a student actually answered: MCQs (categories 1-4) and the story (category 5)."""
    session = db.get(TestSession, session_id)
    if session is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Session not found")

    details: list[ResponseDetail] = []
    for a in sorted(session.assignments, key=lambda x: (x.category, x.position)):
        q = a.question or a.comprehension_question
        if q is None:
            continue
        resp = a.response
        details.append(
            ResponseDetail(
                assignment_id=a.id,
                category=a.category,
                difficulty=a.difficulty,
                position=a.position,
                q_code=q.q_code,
                question_text=q.question_text,
                options=OptionView(a=q.opt_a, b=q.opt_b, c=q.opt_c, d=q.opt_d),
                correct_answer=q.answer,
                selected_option=resp.selected_option if resp else None,
                answered=bool(resp and resp.selected_option is not None),
                is_correct=bool(resp and resp.is_correct),
                points_awarded=resp.points_awarded if resp else 0,
            )
        )

    story: StoryAnswerDetail | None = None
    if session.story_responses:
        sr = session.story_responses[0]
        story = StoryAnswerDetail(
            prompt_text=sr.prompt.prompt_text if sr.prompt else "",
            answer_text=sr.answer_text,
            submitted_at=sr.submitted_at,
        )

    reg = session.registration
    return SessionResponses(
        session_id=session.id,
        first_name=reg.first_name,
        last_name=reg.last_name,
        nilai=reg.nilai,
        email=reg.email,
        status=session.status,
        responses=details,
        story=story,
    )


@router.post("/sessions/{session_id}/manual-score", response_model=SessionProgress)
def set_manual_score(
    session_id: int,
    payload: ManualScoreIn,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    session = db.get(TestSession, session_id)
    if session is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Session not found")

    ms = next((m for m in session.manual_scores if m.category == payload.category), None)
    if ms is None:
        ms = ManualScore(
            session_id=session.id,
            category=payload.category,
            score=payload.score,
            scored_by=admin.id,
        )
        db.add(ms)
    else:
        ms.score = payload.score
        ms.scored_by = admin.id
    db.commit()
    db.refresh(session)

    reg = session.registration
    return SessionProgress(
        registration_id=reg.id,
        session_id=session.id,
        first_name=reg.first_name,
        last_name=reg.last_name,
        nilai=reg.nilai,
        email=reg.email,
        status=session.status,
        current_category=session.current_category,
        current_difficulty=session.current_difficulty,
        final_difficulty=final_difficulty(session),
        auto_score=auto_total(session),
        cat5_score=manual_score(session, 5),
        cat6_score=manual_score(session, 6),
        total_score=grand_total(session),
        focus_loss_count=session.focus_loss_count or 0,
        started_at=session.started_at,
        completed_at=session.completed_at,
    )
