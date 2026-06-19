import { useEffect, useState } from "react";
import { adminQuestions, errorMessage } from "../../../api/client";
import { ErrorAlert, Spinner, SuccessAlert } from "../../../components/common";

export default function StoryPromptTab({ testId }: { testId: number }) {
  const [text, setText] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    adminQuestions
      .getStoryPrompt(testId)
      .then((p) => {
        setText(p?.prompt_text ?? "");
        setLoaded(true);
      })
      .catch((e) => setError(errorMessage(e)));
  }, [testId]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await adminQuestions.setStoryPrompt(testId, text);
      setNotice("Story prompt saved.");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (!loaded && !error) return <Spinner />;

  return (
    <div className="card">
      <h3>Story writing prompt (Category 5)</h3>
      <p className="muted" style={{ fontSize: "0.85rem" }}>
        Free-text writing, 30 minutes. Scored manually after the test. Students see this prompt and a text area.
      </p>
      <ErrorAlert message={error} />
      <SuccessAlert message={notice} />
      <form onSubmit={save}>
        <label>Prompt</label>
        <textarea rows={5} value={text} onChange={(e) => setText(e.target.value)} required placeholder="Write a short story about…" />
        <div className="actions">
          <button className="btn" type="submit" disabled={busy}>{busy ? "Saving…" : "Save prompt"}</button>
        </div>
      </form>
    </div>
  );
}
