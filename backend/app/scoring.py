"""Score aggregation shared by admin progress views and the student score view."""

from __future__ import annotations

from .models import TestSession


def auto_category_scores(session: TestSession) -> dict[int, int]:
    """Points per category for the auto-graded categories (1-4)."""
    scores: dict[int, int] = {1: 0, 2: 0, 3: 0, 4: 0}
    for a in session.assignments:
        if a.response and a.category in scores:
            scores[a.category] += a.response.points_awarded
    return scores


def manual_score(session: TestSession, category: int) -> int | None:
    for ms in session.manual_scores:
        if ms.category == category:
            return ms.score
    return None


def auto_total(session: TestSession) -> int:
    return sum(auto_category_scores(session).values())


def grand_total(session: TestSession) -> int | None:
    """Full score including manual categories 5 & 6, or None if not yet entered."""
    c5 = manual_score(session, 5)
    c6 = manual_score(session, 6)
    if c5 is None or c6 is None:
        return None
    return auto_total(session) + c5 + c6


def final_difficulty(session: TestSession) -> str | None:
    """The difficulty level frozen at the end of category 3 (for oral prep)."""
    cat3_batches = [b for b in session.batch_results if b.category == 3]
    if cat3_batches:
        last = max(cat3_batches, key=lambda b: b.batch_no)
        return last.ending_difficulty
    # Fall back to wherever the session currently sits.
    return session.current_difficulty
