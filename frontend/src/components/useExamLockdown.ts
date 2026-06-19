import { useEffect } from "react";

/**
 * Exam lockdown deterrents, active only while the test is in progress.
 *
 * Blocks the easy ways to lift question text (selection, copy/cut/paste,
 * right-click, drag) and risky keyboard shortcuts, and reports when the student
 * switches away from the test tab/window via `onFocusLoss`.
 *
 * These are deterrents, not a guarantee — a determined cheater can still use a
 * second device or a camera. The focus-loss signal is the auditable part.
 */
export function useExamLockdown(active: boolean, onFocusLoss?: () => void) {
  useEffect(() => {
    if (!active) return;

    const prevent = (e: Event) => e.preventDefault();

    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      const ctrl = e.ctrlKey || e.metaKey;
      // Copy / cut / paste / save / print / view-source
      if (ctrl && ["c", "x", "v", "s", "p", "u"].includes(k)) {
        e.preventDefault();
        return;
      }
      // Devtools
      if (k === "f12" || (ctrl && e.shiftKey && ["i", "j", "c"].includes(k))) {
        e.preventDefault();
      }
    };

    const onVisibility = () => {
      if (document.hidden) onFocusLoss?.();
    };

    document.addEventListener("contextmenu", prevent);
    document.addEventListener("copy", prevent);
    document.addEventListener("cut", prevent);
    document.addEventListener("paste", prevent);
    document.addEventListener("dragstart", prevent);
    document.addEventListener("keydown", onKey);
    document.addEventListener("visibilitychange", onVisibility);
    document.body.classList.add("exam-locked");

    return () => {
      document.removeEventListener("contextmenu", prevent);
      document.removeEventListener("copy", prevent);
      document.removeEventListener("cut", prevent);
      document.removeEventListener("paste", prevent);
      document.removeEventListener("dragstart", prevent);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("visibilitychange", onVisibility);
      document.body.classList.remove("exam-locked");
    };
  }, [active, onFocusLoss]);
}
