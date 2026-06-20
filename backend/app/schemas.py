from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator


# --- Admin auth ---
class AdminLogin(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    name: str


# --- Registration ---
class RegistrationCreate(BaseModel):
    test_id: int
    first_name: str = Field(min_length=1, max_length=120)
    last_name: str = Field(min_length=1, max_length=120)
    nilai: str = Field(min_length=1, max_length=60)
    email: EmailStr
    confirm_email: EmailStr

    @model_validator(mode="after")
    def emails_match(self) -> RegistrationCreate:
        if self.email.lower() != self.confirm_email.lower():
            raise ValueError("Email and confirmation email do not match")
        return self


class RegistrationOut(BaseModel):
    id: int
    test_id: int
    first_name: str
    last_name: str
    nilai: str
    email: str
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class AdminRegistrationCreate(BaseModel):
    first_name: str = Field(min_length=1, max_length=120)
    last_name: str = Field(min_length=1, max_length=120)
    nilai: str = Field(min_length=1, max_length=60)
    email: EmailStr


# --- Tests ---
class TestCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: str | None = None
    scheduled_date: datetime | None = None


class TestUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=255)
    description: str | None = None
    scheduled_date: datetime | None = None
    status: str | None = None


class TestOut(BaseModel):
    id: int
    name: str
    description: str | None
    scheduled_date: datetime | None
    status: str
    scores_released: bool
    created_at: datetime

    class Config:
        from_attributes = True


class TestStats(BaseModel):
    test: TestOut
    total_registrations: int
    pending_email: int
    awaiting_approval: int
    approved: int
    rejected: int
    sessions_started: int
    sessions_completed: int


# --- Questions ---
class QuestionIn(BaseModel):
    q_code: str = Field(min_length=1, max_length=50)
    q_category: int = Field(ge=1, le=3)
    q_difficulty: str
    question_text: str
    opt_a: str
    opt_b: str
    opt_c: str
    opt_d: str
    answer: str

    @field_validator("q_difficulty")
    @classmethod
    def valid_difficulty(cls, v: str) -> str:
        v = v.strip().lower()
        if v not in {"easy", "moderate", "hard"}:
            raise ValueError("q_difficulty must be easy, moderate, or hard")
        return v

    @field_validator("answer")
    @classmethod
    def valid_answer(cls, v: str) -> str:
        v = v.strip().upper()
        if v not in {"A", "B", "C", "D"}:
            raise ValueError("answer must be A, B, C, or D")
        return v


class QuestionOut(QuestionIn):
    id: int
    test_id: int

    class Config:
        from_attributes = True


class BulkUploadResult(BaseModel):
    inserted: int
    updated: int
    errors: list[str]


# --- Comprehension (Category 4) ---
class ComprehensionQuestionIn(BaseModel):
    q_code: str
    question_text: str
    opt_a: str
    opt_b: str
    opt_c: str
    opt_d: str
    answer: str

    @field_validator("answer")
    @classmethod
    def valid_answer(cls, v: str) -> str:
        v = v.strip().upper()
        if v not in {"A", "B", "C", "D"}:
            raise ValueError("answer must be A, B, C, or D")
        return v


class ComprehensionIn(BaseModel):
    title: str
    paragraph_text: str
    # The whole passage is tagged with one difficulty (easy/moderate/hard).
    difficulty: str = "easy"
    questions: list[ComprehensionQuestionIn]

    @field_validator("difficulty")
    @classmethod
    def valid_difficulty(cls, v: str) -> str:
        v = v.strip().lower()
        if v not in {"easy", "moderate", "hard"}:
            raise ValueError("difficulty must be easy, moderate, or hard")
        return v


class ComprehensionQuestionOut(ComprehensionQuestionIn):
    id: int

    class Config:
        from_attributes = True


class ComprehensionOut(BaseModel):
    id: int
    test_id: int
    title: str
    paragraph_text: str
    difficulty: str
    questions: list[ComprehensionQuestionOut]

    class Config:
        from_attributes = True


# --- Story prompt (Category 5) ---
class StoryPromptIn(BaseModel):
    prompt_text: str


class StoryPromptOut(BaseModel):
    id: int
    test_id: int
    prompt_text: str

    class Config:
        from_attributes = True


# --- Student session / test taking ---
class OptionView(BaseModel):
    a: str
    b: str
    c: str
    d: str


class QuestionView(BaseModel):
    assignment_id: int
    category: int
    position: int
    total_in_category: int
    index_in_category: int
    question_text: str
    options: OptionView
    selected_option: str | None = None


class ComprehensionView(BaseModel):
    title: str
    paragraph_text: str
    questions: list[QuestionView]


class StoryView(BaseModel):
    prompt_id: int
    prompt_text: str
    answer_text: str


class SessionState(BaseModel):
    status: str
    current_category: int
    seconds_left_total: int | None
    seconds_left_category: int | None
    # One of these is populated based on current_category
    question: QuestionView | None = None
    comprehension: ComprehensionView | None = None
    story: StoryView | None = None
    message: str | None = None


class AnswerSubmit(BaseModel):
    assignment_id: int
    selected_option: str | None = None  # A/B/C/D or None to skip

    @field_validator("selected_option")
    @classmethod
    def valid_option(cls, v: str | None) -> str | None:
        if v is None:
            return v
        v = v.strip().upper()
        if v not in {"A", "B", "C", "D"}:
            raise ValueError("selected_option must be A, B, C, D or null")
        return v


class StorySubmit(BaseModel):
    prompt_id: int
    answer_text: str
    final: bool = False  # if true, finish category 5


# --- Admin progress / scoring ---
class ManualScoreIn(BaseModel):
    category: int = Field(ge=5, le=6)
    score: int


class ResponseDetail(BaseModel):
    """One MCQ answer (categories 1-4) as seen by the admin."""

    assignment_id: int
    category: int
    difficulty: str
    position: int
    q_code: str
    question_text: str
    options: OptionView
    correct_answer: str
    selected_option: str | None
    answered: bool
    is_correct: bool
    points_awarded: int


class StoryAnswerDetail(BaseModel):
    """Category 5 free-text answer."""

    prompt_text: str
    answer_text: str
    submitted_at: datetime | None


class SessionResponses(BaseModel):
    """Full breakdown of what a student actually answered."""

    session_id: int
    first_name: str
    last_name: str
    nilai: str
    email: str
    status: str
    responses: list[ResponseDetail]
    story: StoryAnswerDetail | None


class SessionProgress(BaseModel):
    registration_id: int
    session_id: int | None
    first_name: str
    last_name: str
    nilai: str
    email: str
    status: str
    current_category: int | None
    current_difficulty: str | None
    final_difficulty: str | None
    auto_score: int
    cat5_score: int | None
    cat6_score: int | None
    total_score: int | None
    focus_loss_count: int = 0
    started_at: datetime | None
    completed_at: datetime | None


class ScoreBreakdown(BaseModel):
    released: bool
    first_name: str
    category_scores: dict[str, int]
    cat5_score: int | None
    cat6_score: int | None
    auto_total: int
    grand_total: int | None
    final_difficulty: str | None
