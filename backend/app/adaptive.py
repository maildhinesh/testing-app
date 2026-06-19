"""The adaptive test engine.

Drives a student's test session through categories 1-6:
  * Categories 1-3: MCQ, one question at a time, delivered in 2 batches of 5,
    with difficulty that adapts per batch and carries over between categories.
  * Category 4: comprehension passage + 5 questions shown together.
  * Category 5: free-text story, single text area.
  * Category 6: offline oral — only an end screen is shown.

The server is authoritative for timing, difficulty, and scoring.
"""

from __future__ import annotations

import random
from datetime import timedelta

from sqlalchemy.orm import Session

from .models import (
    ADVANCE_THRESHOLD,
    BATCH_SIZE,
    BATCHES_PER_CATEGORY,
    CATEGORY_MAX_DIFFICULTY,
    CATEGORY_MINUTES,
    DIFFICULTY_ORDER,
    DIFFICULTY_POINTS,
    WRONG_PENALTY,
    BatchResult,
    Comprehension,
    Difficulty,
    Question,
    Response,
    SessionAssignment,
    SessionStatus,
    StoryPrompt,
    StoryResponse,
    TestSession,
)
from .schemas import (
    ComprehensionView,
    OptionView,
    QuestionView,
    SessionState,
    StoryView,
)
from .security import utcnow

TOTAL_PER_CATEGORY = BATCH_SIZE * BATCHES_PER_CATEGORY  # 10 for cats 1-3
COMPREHENSION_TOTAL = 5


# --------------------------------------------------------------------------- #
# Small helpers
# --------------------------------------------------------------------------- #
def _bump(difficulty: str, max_difficulty: str) -> str:
    idx = DIFFICULTY_ORDER.index(difficulty)
    cap = DIFFICULTY_ORDER.index(max_difficulty)
    return DIFFICULTY_ORDER[min(idx + 1, cap)]


def _next_position(session: TestSession) -> int:
    if not session.assignments:
        return 1
    return max(a.position for a in session.assignments) + 1


def _category_assignments(session: TestSession, category: int) -> list[SessionAssignment]:
    items = [a for a in session.assignments if a.category == category]
    items.sort(key=lambda a: a.position)
    return items


def _batch_evaluated(session: TestSession, category: int, batch_no: int) -> bool:
    return any(
        b.category == category and b.batch_no == batch_no for b in session.batch_results
    )


def _set_category_deadline(session: TestSession, category: int) -> None:
    now = utcnow()
    minutes = CATEGORY_MINUTES.get(category)
    if minutes is None:
        session.category_deadline_at = None
        return
    deadline = now + timedelta(minutes=minutes)
    if session.deadline_at and deadline > session.deadline_at:
        deadline = session.deadline_at
    session.category_deadline_at = deadline


# --------------------------------------------------------------------------- #
# Assignment generation
# --------------------------------------------------------------------------- #
def _generate_batch(
    db: Session, session: TestSession, category: int, batch_no: int, target_difficulty: str
) -> None:
    used_ids = {a.question_id for a in session.assignments if a.question_id}

    def pool(difficulty: str | None) -> list[Question]:
        q = db.query(Question).filter(
            Question.test_id == session.test_id,
            Question.q_category == category,
        )
        if difficulty is not None:
            q = q.filter(Question.q_difficulty == difficulty)
        if used_ids:
            q = q.filter(Question.id.notin_(used_ids))
        return q.all()

    chosen = pool(target_difficulty)
    random.shuffle(chosen)
    chosen = chosen[:BATCH_SIZE]

    # Fall back to other difficulties only if the bank lacks enough at the target,
    # so the test never dead-ends. Points always follow the question's own difficulty.
    if len(chosen) < BATCH_SIZE:
        extra = [q for q in pool(None) if q not in chosen]
        random.shuffle(extra)
        chosen.extend(extra[: BATCH_SIZE - len(chosen)])

    position = _next_position(session)
    for q in chosen:
        used_ids.add(q.id)
        # Append through the relationship (not db.add) so the in-memory
        # session.assignments collection stays consistent within _advance;
        # otherwise repeated reads miss freshly-added rows and regenerate.
        session.assignments.append(
            SessionAssignment(
                category=category,
                batch_no=batch_no,
                position=position,
                difficulty=q.q_difficulty,
                question_id=q.id,
            )
        )
        position += 1
    db.flush()


def _generate_comprehension(db: Session, session: TestSession) -> None:
    # Pick a random passage matching the difficulty the student carried into
    # Category 4. Fall back to any passage if none exist at that level so the
    # test never dead-ends. All questions score at the passage's difficulty.
    pool = (
        db.query(Comprehension)
        .filter(
            Comprehension.test_id == session.test_id,
            Comprehension.difficulty == session.current_difficulty,
        )
        .all()
    )
    if not pool:
        pool = db.query(Comprehension).filter(Comprehension.test_id == session.test_id).all()
    if not pool:
        return
    comp = random.choice(pool)
    position = _next_position(session)
    for cq in sorted(comp.questions, key=lambda x: x.id):
        session.assignments.append(
            SessionAssignment(
                category=4,
                batch_no=1,
                position=position,
                difficulty=comp.difficulty,
                comprehension_question_id=cq.id,
            )
        )
        position += 1
    db.flush()


def _ensure_story(db: Session, session: TestSession) -> None:
    existing = next((s for s in session.story_responses), None)
    if existing is not None:
        return
    prompt = (
        db.query(StoryPrompt)
        .filter(StoryPrompt.test_id == session.test_id)
        .order_by(StoryPrompt.id)
        .first()
    )
    if prompt is None:
        return
    session.story_responses.append(StoryResponse(prompt_id=prompt.id, answer_text=""))
    db.flush()


# --------------------------------------------------------------------------- #
# Scoring + batch evaluation
# --------------------------------------------------------------------------- #
def _correct_answer_for(assignment: SessionAssignment) -> str | None:
    if assignment.question is not None:
        return assignment.question.answer
    if assignment.comprehension_question is not None:
        return assignment.comprehension_question.answer
    return None


def _score_response(assignment: SessionAssignment, option: str | None) -> tuple[bool, int]:
    if option is None:
        return False, 0
    answer = _correct_answer_for(assignment)
    if answer is not None and option.upper() == answer.upper():
        return True, DIFFICULTY_POINTS.get(assignment.difficulty, 1)
    return False, WRONG_PENALTY


def _evaluate_batch(db: Session, session: TestSession, category: int, batch_no: int) -> None:
    target = session.current_difficulty
    assignments = [
        a for a in session.assignments if a.category == category and a.batch_no == batch_no
    ]
    correct = sum(1 for a in assignments if a.response and a.response.is_correct)
    points = sum(a.response.points_awarded for a in assignments if a.response)

    ending = target
    if correct >= ADVANCE_THRESHOLD:
        ending = _bump(target, CATEGORY_MAX_DIFFICULTY[category])
    session.current_difficulty = ending

    session.batch_results.append(
        BatchResult(
            category=category,
            batch_no=batch_no,
            correct_count=correct,
            points=points,
            batch_difficulty=target,
            ending_difficulty=ending,
        )
    )
    db.flush()


def _fill_skips(db: Session, session: TestSession, category: int) -> None:
    """Record skipped (null) responses for unanswered assignments in a category."""
    for a in _category_assignments(session, category):
        if a.response is None:
            a.response = Response(
                session_id=session.id,
                selected_option=None,
                is_correct=False,
                points_awarded=0,
            )
    db.flush()


# --------------------------------------------------------------------------- #
# Category lifecycle
# --------------------------------------------------------------------------- #
def _finish(db: Session, session: TestSession, timed_out: bool) -> None:
    session.status = SessionStatus.timed_out.value if timed_out else SessionStatus.completed.value
    session.completed_at = utcnow()
    session.category_deadline_at = None
    session.current_category = 6
    db.flush()


def _setup_category(db: Session, session: TestSession, category: int) -> None:
    session.current_category = category
    if category in (1, 2, 3):
        _set_category_deadline(session, category)
        _generate_batch(db, session, category, 1, session.current_difficulty)
    elif category == 4:
        _set_category_deadline(session, category)
        _generate_comprehension(db, session)
    elif category == 5:
        _set_category_deadline(session, category)
        _ensure_story(db, session)
    else:  # category 6 -> offline; test is complete
        _finish(db, session, timed_out=False)
    db.flush()


def _advance_category(db: Session, session: TestSession) -> None:
    _setup_category(db, session, session.current_category + 1)


def _timeout_current_category(db: Session, session: TestSession) -> None:
    cat = session.current_category
    if cat in (1, 2, 3):
        _fill_skips(db, session, cat)
        for batch_no in range(1, BATCHES_PER_CATEGORY + 1):
            has_assignments = any(
                a.category == cat and a.batch_no == batch_no for a in session.assignments
            )
            if has_assignments and not _batch_evaluated(session, cat, batch_no):
                _evaluate_batch(db, session, cat, batch_no)
        _advance_category(db, session)
    elif cat == 4:
        _fill_skips(db, session, 4)
        _advance_category(db, session)
    elif cat == 5:
        _finalize_story(db, session)
        _advance_category(db, session)


def _enforce_time(db: Session, session: TestSession) -> bool:
    if session.status != SessionStatus.in_progress.value:
        return False
    now = utcnow()
    if session.deadline_at and now >= session.deadline_at:
        _finish(db, session, timed_out=True)
        return True
    if (
        session.category_deadline_at
        and now >= session.category_deadline_at
        and session.current_category in (1, 2, 3, 4, 5)
    ):
        _timeout_current_category(db, session)
        return True
    return False


def _finalize_story(db: Session, session: TestSession) -> None:
    for sr in session.story_responses:
        if sr.submitted_at is None:
            sr.submitted_at = utcnow()
    db.flush()


# --------------------------------------------------------------------------- #
# Main resolver: bring the session to a stable state awaiting user input
# --------------------------------------------------------------------------- #
def _advance(db: Session, session: TestSession) -> None:
    for _ in range(60):  # safety bound against any logic loop
        if session.status in (SessionStatus.completed.value, SessionStatus.timed_out.value):
            return
        if _enforce_time(db, session):
            continue

        cat = session.current_category
        if cat in (1, 2, 3):
            assignments = _category_assignments(session, cat)
            if not assignments:
                _generate_batch(db, session, cat, 1, session.current_difficulty)
                continue
            if any(a.response is None for a in assignments):
                return  # awaiting the next question's answer
            last_batch = max(a.batch_no for a in assignments)
            if not _batch_evaluated(session, cat, last_batch):
                _evaluate_batch(db, session, cat, last_batch)
                continue
            if last_batch < BATCHES_PER_CATEGORY:
                _generate_batch(db, session, cat, last_batch + 1, session.current_difficulty)
                continue
            _advance_category(db, session)
            continue
        if cat == 4:
            if not _category_assignments(session, 4):
                _generate_comprehension(db, session)
            return  # comprehension is committed explicitly (or on timeout)
        if cat == 5:
            _ensure_story(db, session)
            return  # story is committed explicitly (or on timeout)
        # category 6+ -> finished
        _finish(db, session, timed_out=False)
        return


# --------------------------------------------------------------------------- #
# Public operations used by the router
# --------------------------------------------------------------------------- #
def start_or_resume(db: Session, session: TestSession) -> None:
    if session.status == SessionStatus.not_started.value:
        now = utcnow()
        session.status = SessionStatus.in_progress.value
        session.started_at = now
        from .config import settings

        session.deadline_at = now + timedelta(minutes=settings.test_total_minutes)
        _setup_category(db, session, 1)
    _advance(db, session)
    db.commit()
    db.refresh(session)


def refresh_state(db: Session, session: TestSession) -> None:
    _advance(db, session)
    db.commit()
    db.refresh(session)


def submit_answer(
    db: Session, session: TestSession, assignment_id: int, option: str | None
) -> None:
    if session.status != SessionStatus.in_progress.value:
        return
    # Enforce timers before accepting an answer.
    if _enforce_time(db, session):
        db.commit()
        db.refresh(session)
        return

    assignment = next((a for a in session.assignments if a.id == assignment_id), None)
    if assignment is None:
        raise ValueError("Unknown assignment for this session")
    if assignment.category != session.current_category:
        raise ValueError("This question is not in the active category")

    correct, points = _score_response(assignment, option)
    if assignment.response is None:
        # Link via the relationship so assignment.response is immediately set
        # in memory — _advance checks it right after, before any reload.
        assignment.response = Response(
            session_id=session.id,
            selected_option=option,
            is_correct=correct,
            points_awarded=points,
        )
    elif assignment.category == 4:
        # Comprehension answers may be revised until the category is committed.
        assignment.response.selected_option = option
        assignment.response.is_correct = correct
        assignment.response.points_awarded = points
    else:
        raise ValueError("This question has already been answered")
    db.flush()
    _advance(db, session)
    db.commit()
    db.refresh(session)


def finish_comprehension(db: Session, session: TestSession) -> None:
    if session.status != SessionStatus.in_progress.value or session.current_category != 4:
        return
    _fill_skips(db, session, 4)
    _advance_category(db, session)
    _advance(db, session)
    db.commit()
    db.refresh(session)


def save_story(
    db: Session, session: TestSession, prompt_id: int, text: str, final: bool
) -> None:
    if session.status != SessionStatus.in_progress.value or session.current_category != 5:
        return
    if _enforce_time(db, session):
        db.commit()
        db.refresh(session)
        return
    sr = next((s for s in session.story_responses if s.prompt_id == prompt_id), None)
    if sr is None:
        sr = StoryResponse(prompt_id=prompt_id, answer_text="")
        session.story_responses.append(sr)
    sr.answer_text = text
    if final:
        _finalize_story(db, session)
        _advance_category(db, session)
        _advance(db, session)
    db.commit()
    db.refresh(session)


# --------------------------------------------------------------------------- #
# Rendering
# --------------------------------------------------------------------------- #
def _seconds_left(deadline) -> int | None:
    if deadline is None:
        return None
    delta = (deadline - utcnow()).total_seconds()
    return max(0, int(delta))


def _question_view(session: TestSession, assignment: SessionAssignment, total: int) -> QuestionView:
    src = assignment.question or assignment.comprehension_question
    answered_before = sum(
        1
        for a in session.assignments
        if a.category == assignment.category
        and a.position < assignment.position
    )
    return QuestionView(
        assignment_id=assignment.id,
        category=assignment.category,
        position=assignment.position,
        total_in_category=total,
        index_in_category=answered_before + 1,
        question_text=src.question_text,
        options=OptionView(a=src.opt_a, b=src.opt_b, c=src.opt_c, d=src.opt_d),
        selected_option=assignment.response.selected_option if assignment.response else None,
    )


def render_state(session: TestSession) -> SessionState:
    status = session.status
    if status == SessionStatus.completed.value:
        return SessionState(
            status=status,
            current_category=6,
            seconds_left_total=None,
            seconds_left_category=None,
            message=(
                "Your written test is complete. Please proceed to the oral part "
                "(Category 6) with the test administrator."
            ),
        )
    if status == SessionStatus.timed_out.value:
        return SessionState(
            status=status,
            current_category=6,
            seconds_left_total=None,
            seconds_left_category=None,
            message=(
                "Time is up — the 75-minute limit has been reached. Your written test "
                "has ended. Please proceed to the oral part with the administrator."
            ),
        )
    if status == SessionStatus.not_started.value:
        return SessionState(
            status=status,
            current_category=session.current_category,
            seconds_left_total=None,
            seconds_left_category=None,
            message="Your test has not started yet.",
        )

    seconds_total = _seconds_left(session.deadline_at)
    seconds_cat = _seconds_left(session.category_deadline_at)
    cat = session.current_category

    if cat in (1, 2, 3):
        assignments = _category_assignments(session, cat)
        current = next((a for a in assignments if a.response is None), None)
        if current is not None:
            return SessionState(
                status=status,
                current_category=cat,
                seconds_left_total=seconds_total,
                seconds_left_category=seconds_cat,
                question=_question_view(session, current, TOTAL_PER_CATEGORY),
            )
    elif cat == 4:
        assignments = _category_assignments(session, 4)
        comp = None
        if assignments:
            first = assignments[0].comprehension_question
            comp = first.comprehension if first else None
        questions = [_question_view(session, a, COMPREHENSION_TOTAL) for a in assignments]
        return SessionState(
            status=status,
            current_category=4,
            seconds_left_total=seconds_total,
            seconds_left_category=seconds_cat,
            comprehension=ComprehensionView(
                title=comp.title if comp else "Comprehension",
                paragraph_text=comp.paragraph_text if comp else "",
                questions=questions,
            ),
        )
    elif cat == 5:
        sr = next((s for s in session.story_responses), None)
        if sr is not None:
            return SessionState(
                status=status,
                current_category=5,
                seconds_left_total=seconds_total,
                seconds_left_category=seconds_cat,
                story=StoryView(
                    prompt_id=sr.prompt_id,
                    prompt_text=sr.prompt.prompt_text if sr.prompt else "",
                    answer_text=sr.answer_text,
                ),
            )

    # Fallback (e.g. a category has no content configured): keep moving.
    return SessionState(
        status=status,
        current_category=cat,
        seconds_left_total=seconds_total,
        seconds_left_category=seconds_cat,
        message="Loading…",
    )
