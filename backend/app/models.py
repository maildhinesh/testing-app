from __future__ import annotations

import enum
from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


# --- Enumerations (stored as strings) ---
class Difficulty(str, enum.Enum):
    easy = "easy"
    moderate = "moderate"
    hard = "hard"


class TestStatus(str, enum.Enum):
    draft = "draft"
    scheduled = "scheduled"
    released = "released"
    closed = "closed"


class RegistrationStatus(str, enum.Enum):
    pending_email = "pending_email"
    email_verified = "email_verified"
    approved = "approved"
    rejected = "rejected"


class SessionStatus(str, enum.Enum):
    not_started = "not_started"
    in_progress = "in_progress"
    completed = "completed"
    timed_out = "timed_out"


# Category time limits in minutes (categories 1-5; 6 is offline)
CATEGORY_MINUTES = {1: 10, 2: 10, 3: 10, 4: 15, 5: 30}
# Points per difficulty
DIFFICULTY_POINTS = {"easy": 1, "moderate": 2, "hard": 3}
# Max difficulty reachable per category
CATEGORY_MAX_DIFFICULTY = {1: "moderate", 2: "hard", 3: "hard"}
DIFFICULTY_ORDER = ["easy", "moderate", "hard"]
WRONG_PENALTY = -1
BATCH_SIZE = 5
BATCHES_PER_CATEGORY = 2  # categories 1-3
ADVANCE_THRESHOLD = 4  # correct answers in a batch to bump difficulty


class Admin(Base):
    __tablename__ = "admins"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    name: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Test(Base):
    __tablename__ = "tests"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    scheduled_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default=TestStatus.draft.value)
    scores_released: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    questions: Mapped[list[Question]] = relationship(back_populates="test", cascade="all, delete-orphan")
    comprehensions: Mapped[list[Comprehension]] = relationship(
        back_populates="test", cascade="all, delete-orphan"
    )
    story_prompts: Mapped[list[StoryPrompt]] = relationship(
        back_populates="test", cascade="all, delete-orphan"
    )
    registrations: Mapped[list[Registration]] = relationship(
        back_populates="test", cascade="all, delete-orphan"
    )


class Question(Base):
    """Question bank for categories 1, 2, 3."""

    __tablename__ = "questions"
    __table_args__ = (UniqueConstraint("test_id", "q_code", name="uq_question_test_code"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    test_id: Mapped[int] = mapped_column(ForeignKey("tests.id", ondelete="CASCADE"), index=True)
    q_code: Mapped[str] = mapped_column(String(50))
    q_category: Mapped[int] = mapped_column(Integer)  # 1, 2, or 3
    q_difficulty: Mapped[str] = mapped_column(String(20))
    question_text: Mapped[str] = mapped_column(Text)
    opt_a: Mapped[str] = mapped_column(Text)
    opt_b: Mapped[str] = mapped_column(Text)
    opt_c: Mapped[str] = mapped_column(Text)
    opt_d: Mapped[str] = mapped_column(Text)
    answer: Mapped[str] = mapped_column(String(1))  # 'A' | 'B' | 'C' | 'D'

    test: Mapped[Test] = relationship(back_populates="questions")


class Comprehension(Base):
    """Category 4 passage."""

    __tablename__ = "comprehensions"

    id: Mapped[int] = mapped_column(primary_key=True)
    test_id: Mapped[int] = mapped_column(ForeignKey("tests.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(255))
    paragraph_text: Mapped[str] = mapped_column(Text)
    # Difficulty applies to the whole passage; all its questions score at this level.
    # A test may have several passages per difficulty — one is chosen at random for
    # each student based on the difficulty they carried into Category 4.
    difficulty: Mapped[str] = mapped_column(String(20), default=Difficulty.easy.value)

    test: Mapped[Test] = relationship(back_populates="comprehensions")
    questions: Mapped[list[ComprehensionQuestion]] = relationship(
        back_populates="comprehension", cascade="all, delete-orphan"
    )


class ComprehensionQuestion(Base):
    """Category 4 questions (5 per passage)."""

    __tablename__ = "comprehension_questions"

    id: Mapped[int] = mapped_column(primary_key=True)
    comprehension_id: Mapped[int] = mapped_column(
        ForeignKey("comprehensions.id", ondelete="CASCADE"), index=True
    )
    q_code: Mapped[str] = mapped_column(String(50))
    question_text: Mapped[str] = mapped_column(Text)
    opt_a: Mapped[str] = mapped_column(Text)
    opt_b: Mapped[str] = mapped_column(Text)
    opt_c: Mapped[str] = mapped_column(Text)
    opt_d: Mapped[str] = mapped_column(Text)
    answer: Mapped[str] = mapped_column(String(1))

    comprehension: Mapped[Comprehension] = relationship(back_populates="questions")


class StoryPrompt(Base):
    """Category 5 writing prompt."""

    __tablename__ = "story_prompts"

    id: Mapped[int] = mapped_column(primary_key=True)
    test_id: Mapped[int] = mapped_column(ForeignKey("tests.id", ondelete="CASCADE"), index=True)
    prompt_text: Mapped[str] = mapped_column(Text)

    test: Mapped[Test] = relationship(back_populates="story_prompts")


class Registration(Base):
    __tablename__ = "registrations"
    __table_args__ = (UniqueConstraint("test_id", "email", name="uq_registration_test_email"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    test_id: Mapped[int] = mapped_column(ForeignKey("tests.id", ondelete="CASCADE"), index=True)
    first_name: Mapped[str] = mapped_column(String(120))
    last_name: Mapped[str] = mapped_column(String(120))
    nilai: Mapped[str] = mapped_column(String(60))  # Class
    email: Mapped[str] = mapped_column(String(255), index=True)
    status: Mapped[str] = mapped_column(String(30), default=RegistrationStatus.pending_email.value)

    email_verify_token: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    email_verify_expires: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    email_verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    magic_token: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    magic_token_expires: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    test: Mapped[Test] = relationship(back_populates="registrations")
    session: Mapped[TestSession | None] = relationship(
        back_populates="registration", cascade="all, delete-orphan", uselist=False
    )


class TestSession(Base):
    __tablename__ = "test_sessions"

    id: Mapped[int] = mapped_column(primary_key=True)
    registration_id: Mapped[int] = mapped_column(
        ForeignKey("registrations.id", ondelete="CASCADE"), unique=True, index=True
    )
    test_id: Mapped[int] = mapped_column(ForeignKey("tests.id", ondelete="CASCADE"), index=True)
    status: Mapped[str] = mapped_column(String(20), default=SessionStatus.not_started.value)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    deadline_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    current_category: Mapped[int] = mapped_column(Integer, default=1)
    current_difficulty: Mapped[str] = mapped_column(String(20), default=Difficulty.easy.value)
    # Per-category deadline for the active category
    category_deadline_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # Anti-cheating: number of times the student left the test tab/window.
    focus_loss_count: Mapped[int] = mapped_column(Integer, default=0)

    registration: Mapped[Registration] = relationship(back_populates="session")
    assignments: Mapped[list[SessionAssignment]] = relationship(
        back_populates="session", cascade="all, delete-orphan"
    )
    responses: Mapped[list[Response]] = relationship(
        back_populates="session", cascade="all, delete-orphan"
    )
    batch_results: Mapped[list[BatchResult]] = relationship(
        back_populates="session", cascade="all, delete-orphan"
    )
    story_responses: Mapped[list[StoryResponse]] = relationship(
        back_populates="session", cascade="all, delete-orphan"
    )
    manual_scores: Mapped[list[ManualScore]] = relationship(
        back_populates="session", cascade="all, delete-orphan"
    )


class SessionAssignment(Base):
    """The exact questions assigned to a user, in their unique order."""

    __tablename__ = "session_assignments"

    id: Mapped[int] = mapped_column(primary_key=True)
    session_id: Mapped[int] = mapped_column(
        ForeignKey("test_sessions.id", ondelete="CASCADE"), index=True
    )
    category: Mapped[int] = mapped_column(Integer)
    batch_no: Mapped[int] = mapped_column(Integer)  # 1 or 2 for cats 1-3; 1 for cat 4
    position: Mapped[int] = mapped_column(Integer)  # order within the test
    difficulty: Mapped[str] = mapped_column(String(20))
    # Reference to source question (one of the two will be set)
    question_id: Mapped[int | None] = mapped_column(
        ForeignKey("questions.id", ondelete="CASCADE"), nullable=True
    )
    comprehension_question_id: Mapped[int | None] = mapped_column(
        ForeignKey("comprehension_questions.id", ondelete="CASCADE"), nullable=True
    )

    session: Mapped[TestSession] = relationship(back_populates="assignments")
    question: Mapped[Question | None] = relationship()
    comprehension_question: Mapped[ComprehensionQuestion | None] = relationship()
    response: Mapped[Response | None] = relationship(
        back_populates="assignment", cascade="all, delete-orphan", uselist=False
    )


class Response(Base):
    """An answer to an MCQ assignment (categories 1-4)."""

    __tablename__ = "responses"

    id: Mapped[int] = mapped_column(primary_key=True)
    session_id: Mapped[int] = mapped_column(
        ForeignKey("test_sessions.id", ondelete="CASCADE"), index=True
    )
    assignment_id: Mapped[int] = mapped_column(
        ForeignKey("session_assignments.id", ondelete="CASCADE"), unique=True, index=True
    )
    selected_option: Mapped[str | None] = mapped_column(String(1), nullable=True)  # None = skipped
    is_correct: Mapped[bool] = mapped_column(Boolean, default=False)
    points_awarded: Mapped[int] = mapped_column(Integer, default=0)
    answered_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    session: Mapped[TestSession] = relationship(back_populates="responses")
    assignment: Mapped[SessionAssignment] = relationship(back_populates="response")


class BatchResult(Base):
    """Outcome of a batch of 5 (categories 1-3) for adaptive transitions + audit."""

    __tablename__ = "batch_results"

    id: Mapped[int] = mapped_column(primary_key=True)
    session_id: Mapped[int] = mapped_column(
        ForeignKey("test_sessions.id", ondelete="CASCADE"), index=True
    )
    category: Mapped[int] = mapped_column(Integer)
    batch_no: Mapped[int] = mapped_column(Integer)
    correct_count: Mapped[int] = mapped_column(Integer, default=0)
    points: Mapped[int] = mapped_column(Integer, default=0)
    batch_difficulty: Mapped[str] = mapped_column(String(20))
    ending_difficulty: Mapped[str] = mapped_column(String(20))

    session: Mapped[TestSession] = relationship(back_populates="batch_results")


class StoryResponse(Base):
    """Category 5 free-text answer."""

    __tablename__ = "story_responses"

    id: Mapped[int] = mapped_column(primary_key=True)
    session_id: Mapped[int] = mapped_column(
        ForeignKey("test_sessions.id", ondelete="CASCADE"), index=True
    )
    prompt_id: Mapped[int] = mapped_column(ForeignKey("story_prompts.id", ondelete="CASCADE"))
    answer_text: Mapped[str] = mapped_column(Text, default="")
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    session: Mapped[TestSession] = relationship(back_populates="story_responses")
    prompt: Mapped[StoryPrompt] = relationship()


class ManualScore(Base):
    """Admin-entered scores for categories 5 (story) and 6 (oral)."""

    __tablename__ = "manual_scores"
    __table_args__ = (UniqueConstraint("session_id", "category", name="uq_manual_session_category"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    session_id: Mapped[int] = mapped_column(
        ForeignKey("test_sessions.id", ondelete="CASCADE"), index=True
    )
    category: Mapped[int] = mapped_column(Integer)  # 5 or 6
    score: Mapped[int] = mapped_column(Integer, default=0)
    scored_by: Mapped[int | None] = mapped_column(ForeignKey("admins.id"), nullable=True)
    scored_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    session: Mapped[TestSession] = relationship(back_populates="manual_scores")
