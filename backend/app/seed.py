"""Seed a sample test with a full question bank so the app can be tried end-to-end.

Run from the backend directory:  python -m app.seed
"""

from __future__ import annotations

from .database import Base, SessionLocal, engine
from .models import (
    Comprehension,
    ComprehensionQuestion,
    Question,
    StoryPrompt,
    Test,
    TestStatus,
)


def _mcq(code, cat, diff, n):
    """A throwaway MCQ where option A is always correct (for demo)."""
    return Question(
        q_code=code,
        q_category=cat,
        q_difficulty=diff,
        question_text=f"[{diff.title()}] Category {cat} sample question {n}?",
        opt_a="Correct option",
        opt_b="Wrong option B",
        opt_c="Wrong option C",
        opt_d="Wrong option D",
        answer="A",
    )


def seed() -> None:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        existing = db.query(Test).filter(Test.name == "Sample Tamil Test").first()
        if existing is not None:
            print(f"Sample test already exists (id={existing.id}). Nothing to do.")
            return

        test = Test(
            name="Sample Tamil Test",
            description="Demo test seeded with a full question bank.",
            status=TestStatus.scheduled.value,
        )
        db.add(test)
        db.flush()

        # Categories 1-3: plenty per difficulty so adaptation always has questions.
        for cat in (1, 2, 3):
            difficulties = ["easy", "moderate"] if cat == 1 else ["easy", "moderate", "hard"]
            for diff in difficulties:
                for n in range(1, 9):  # 8 per difficulty
                    test.questions.append(_mcq(f"C{cat}-{diff[:1].upper()}-{n}", cat, diff, n))

        # Category 4: each passage is tagged with one difficulty, and there are
        # two passages per difficulty so the engine has a pool to randomly pick
        # from based on the difficulty the student carried into this category.
        for diff in ("easy", "moderate", "hard"):
            for variant in (1, 2):
                comp = Comprehension(
                    title=f"{diff.title()} Passage {variant}",
                    difficulty=diff,
                    paragraph_text=(
                        f"[{diff.title()} passage {variant}] "
                        "ஒரு சிறிய கிராமத்தில் ஒரு விவசாயி வாழ்ந்து வந்தார். "
                        "அவர் தினமும் காலையில் வயலுக்குச் சென்று உழைத்தார். "
                        "(Sample passage text for the comprehension category.)"
                    ),
                )
                for i in range(1, 6):  # 5 questions per passage
                    comp.questions.append(
                        ComprehensionQuestion(
                            q_code=f"C4-{diff[:1].upper()}{variant}-{i}",
                            question_text=f"[{diff.title()} {variant}] Comprehension question {i}?",
                            opt_a="Correct option",
                            opt_b="Wrong B",
                            opt_c="Wrong C",
                            opt_d="Wrong D",
                            answer="A",
                        )
                    )
                test.comprehensions.append(comp)

        # Category 5: writing prompt.
        test.story_prompts.append(
            StoryPrompt(
                prompt_text=(
                    "Write a short story (in Tamil) about a memorable day. "
                    "உங்களுக்கு மறக்க முடியாத ஒரு நாளைப் பற்றி ஒரு சிறுகதை எழுதுங்கள்."
                )
            )
        )

        db.add(test)
        db.commit()
        print(f"Seeded 'Sample Tamil Test' (id={test.id}).")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
