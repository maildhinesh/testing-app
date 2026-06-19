import csv
import io

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_admin
from ..models import (
    Admin,
    Comprehension,
    ComprehensionQuestion,
    Question,
    StoryPrompt,
    Test,
)
from ..schemas import (
    BulkUploadResult,
    ComprehensionIn,
    ComprehensionOut,
    QuestionIn,
    QuestionOut,
    StoryPromptIn,
    StoryPromptOut,
)

router = APIRouter(prefix="/api/admin/tests/{test_id}", tags=["admin-questions"])

REQUIRED_CSV_COLUMNS = [
    "q_code",
    "q_category",
    "q_difficulty",
    "question_text",
    "opt_a",
    "opt_b",
    "opt_c",
    "opt_d",
    "answer",
]


def _ensure_test(db: Session, test_id: int) -> Test:
    test = db.get(Test, test_id)
    if test is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Test not found")
    return test


# --------------------------- Categories 1-3 questions --------------------------- #
@router.get("/questions", response_model=list[QuestionOut])
def list_questions(
    test_id: int,
    category: int | None = None,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    _ensure_test(db, test_id)
    q = db.query(Question).filter(Question.test_id == test_id)
    if category is not None:
        q = q.filter(Question.q_category == category)
    return q.order_by(Question.q_category, Question.q_difficulty, Question.q_code).all()


@router.post("/questions", response_model=QuestionOut, status_code=status.HTTP_201_CREATED)
def create_question(
    test_id: int,
    payload: QuestionIn,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    _ensure_test(db, test_id)
    existing = (
        db.query(Question)
        .filter(Question.test_id == test_id, Question.q_code == payload.q_code)
        .first()
    )
    if existing is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "A question with this q_code already exists.")
    question = Question(test_id=test_id, **payload.model_dump())
    db.add(question)
    db.commit()
    db.refresh(question)
    return question


@router.put("/questions/{question_id}", response_model=QuestionOut)
def update_question(
    test_id: int,
    question_id: int,
    payload: QuestionIn,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    question = db.get(Question, question_id)
    if question is None or question.test_id != test_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Question not found")
    for key, value in payload.model_dump().items():
        setattr(question, key, value)
    db.commit()
    db.refresh(question)
    return question


@router.delete("/questions/{question_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_question(
    test_id: int,
    question_id: int,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    question = db.get(Question, question_id)
    if question is None or question.test_id != test_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Question not found")
    db.delete(question)
    db.commit()


@router.post("/questions/bulk", response_model=BulkUploadResult)
async def bulk_upload_questions(
    test_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    """Upsert questions from a CSV. Key = (test_id, q_code)."""
    _ensure_test(db, test_id)
    raw = await file.read()
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "File must be UTF-8 encoded CSV.")

    reader = csv.DictReader(io.StringIO(text))
    if reader.fieldnames is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "CSV is empty.")
    missing = [c for c in REQUIRED_CSV_COLUMNS if c not in reader.fieldnames]
    if missing:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"CSV missing required columns: {', '.join(missing)}",
        )

    inserted = updated = 0
    errors: list[str] = []
    # Cache existing rows for this test to limit queries.
    existing_by_code = {
        q.q_code: q for q in db.query(Question).filter(Question.test_id == test_id).all()
    }

    for line_no, row in enumerate(reader, start=2):
        try:
            validated = QuestionIn(
                q_code=(row.get("q_code") or "").strip(),
                q_category=int((row.get("q_category") or "").strip()),
                q_difficulty=(row.get("q_difficulty") or "").strip(),
                question_text=(row.get("question_text") or "").strip(),
                opt_a=(row.get("opt_a") or "").strip(),
                opt_b=(row.get("opt_b") or "").strip(),
                opt_c=(row.get("opt_c") or "").strip(),
                opt_d=(row.get("opt_d") or "").strip(),
                answer=(row.get("answer") or "").strip(),
            )
        except (ValueError, TypeError) as exc:
            errors.append(f"Line {line_no}: {exc}")
            continue

        if not validated.q_code:
            errors.append(f"Line {line_no}: q_code is required")
            continue

        existing = existing_by_code.get(validated.q_code)
        if existing is not None:
            for key, value in validated.model_dump().items():
                setattr(existing, key, value)
            updated += 1
        else:
            question = Question(test_id=test_id, **validated.model_dump())
            db.add(question)
            existing_by_code[validated.q_code] = question
            inserted += 1

    db.commit()
    return BulkUploadResult(inserted=inserted, updated=updated, errors=errors)


# --------------------------- Category 4 comprehension --------------------------- #
@router.get("/comprehensions", response_model=list[ComprehensionOut])
def list_comprehensions(
    test_id: int, db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)
):
    _ensure_test(db, test_id)
    return db.query(Comprehension).filter(Comprehension.test_id == test_id).all()


@router.post("/comprehensions", response_model=ComprehensionOut, status_code=201)
def create_comprehension(
    test_id: int,
    payload: ComprehensionIn,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    _ensure_test(db, test_id)
    comp = Comprehension(
        test_id=test_id,
        title=payload.title,
        paragraph_text=payload.paragraph_text,
        difficulty=payload.difficulty,
    )
    for cq in payload.questions:
        comp.questions.append(ComprehensionQuestion(**cq.model_dump()))
    db.add(comp)
    db.commit()
    db.refresh(comp)
    return comp


@router.put("/comprehensions/{comp_id}", response_model=ComprehensionOut)
def update_comprehension(
    test_id: int,
    comp_id: int,
    payload: ComprehensionIn,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    comp = db.get(Comprehension, comp_id)
    if comp is None or comp.test_id != test_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Comprehension not found")
    comp.title = payload.title
    comp.paragraph_text = payload.paragraph_text
    comp.difficulty = payload.difficulty
    comp.questions.clear()
    db.flush()
    for cq in payload.questions:
        comp.questions.append(ComprehensionQuestion(**cq.model_dump()))
    db.commit()
    db.refresh(comp)
    return comp


@router.delete("/comprehensions/{comp_id}", status_code=204)
def delete_comprehension(
    test_id: int,
    comp_id: int,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    comp = db.get(Comprehension, comp_id)
    if comp is None or comp.test_id != test_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Comprehension not found")
    db.delete(comp)
    db.commit()


# --------------------------- Category 5 story prompt --------------------------- #
@router.get("/story-prompt", response_model=StoryPromptOut | None)
def get_story_prompt(
    test_id: int, db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)
):
    _ensure_test(db, test_id)
    return (
        db.query(StoryPrompt)
        .filter(StoryPrompt.test_id == test_id)
        .order_by(StoryPrompt.id)
        .first()
    )


@router.put("/story-prompt", response_model=StoryPromptOut)
def set_story_prompt(
    test_id: int,
    payload: StoryPromptIn,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    _ensure_test(db, test_id)
    prompt = (
        db.query(StoryPrompt)
        .filter(StoryPrompt.test_id == test_id)
        .order_by(StoryPrompt.id)
        .first()
    )
    if prompt is None:
        prompt = StoryPrompt(test_id=test_id, prompt_text=payload.prompt_text)
        db.add(prompt)
    else:
        prompt.prompt_text = payload.prompt_text
    db.commit()
    db.refresh(prompt)
    return prompt
