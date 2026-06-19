import { useEffect, useState } from "react";
import { adminQuestions, errorMessage } from "../../../api/client";
import { ErrorAlert, SuccessAlert } from "../../../components/common";
import type { ComprehensionOut } from "../../../types";

interface CQForm {
  q_code: string;
  question_text: string;
  opt_a: string;
  opt_b: string;
  opt_c: string;
  opt_d: string;
  answer: string;
}

const DIFFICULTIES = ["easy", "moderate", "hard"];
const DIFF_COLOR: Record<string, string> = { easy: "green", moderate: "amber", hard: "red" };

const blankCQ = (i: number): CQForm => ({
  q_code: `C4Q${i + 1}`,
  question_text: "",
  opt_a: "",
  opt_b: "",
  opt_c: "",
  opt_d: "",
  answer: "A",
});

export default function ComprehensionTab({ testId }: { testId: number }) {
  const [comps, setComps] = useState<ComprehensionOut[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | "new" | null>(null);
  const [title, setTitle] = useState("");
  const [difficulty, setDifficulty] = useState("easy");
  const [paragraph, setParagraph] = useState("");
  const [qs, setQs] = useState<CQForm[]>([]);

  function load() {
    adminQuestions
      .listComprehensions(testId)
      .then(setComps)
      .catch((e) => setError(errorMessage(e)));
  }
  useEffect(load, [testId]);

  function startNew() {
    setEditingId("new");
    setTitle("");
    setDifficulty("easy");
    setParagraph("");
    setQs(Array.from({ length: 5 }, (_, i) => blankCQ(i)));
  }
  function startEdit(c: ComprehensionOut) {
    setEditingId(c.id);
    setTitle(c.title);
    setDifficulty(c.difficulty);
    setParagraph(c.paragraph_text);
    setQs(c.questions.map((q) => ({
      q_code: q.q_code,
      question_text: q.question_text,
      opt_a: q.opt_a,
      opt_b: q.opt_b,
      opt_c: q.opt_c,
      opt_d: q.opt_d,
      answer: q.answer,
    })));
  }

  function setQ(idx: number, k: keyof CQForm, v: string) {
    setQs((arr) => arr.map((q, i) => (i === idx ? { ...q, [k]: v } : q)));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    const payload = { title, difficulty, paragraph_text: paragraph, questions: qs };
    try {
      if (editingId === "new") {
        await adminQuestions.createComprehension(testId, payload);
        setNotice("Passage created.");
      } else if (typeof editingId === "number") {
        await adminQuestions.updateComprehension(testId, editingId, payload);
        setNotice("Passage updated.");
      }
      setEditingId(null);
      load();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function remove(c: ComprehensionOut) {
    if (!confirm(`Delete passage "${c.title}"?`)) return;
    try {
      await adminQuestions.removeComprehension(testId, c.id);
      load();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  // Count passages per difficulty to warn about gaps in the pool.
  const counts = DIFFICULTIES.reduce<Record<string, number>>((acc, d) => {
    acc[d] = comps.filter((c) => c.difficulty === d).length;
    return acc;
  }, {});

  return (
    <div>
      <div className="test-header">
        <p className="muted" style={{ margin: 0, maxWidth: 620 }}>
          Each passage is tagged with one difficulty (15 minutes, 5 questions). Students are shown a
          <b> random passage matching the difficulty they reached in Categories 1–3</b>. Add more than
          one passage per difficulty for variety.
        </p>
        {editingId === null && <button className="btn" onClick={startNew}>+ Add passage</button>}
      </div>

      {editingId === null && (
        <div className="row" style={{ marginBottom: 16 }}>
          {DIFFICULTIES.map((d) => (
            <div className="stat" key={d}>
              <div className="num">{counts[d]}</div>
              <div className="lbl">{d} passage(s)</div>
              {counts[d] === 0 && <div className="badge amber" style={{ marginTop: 4 }}>none yet</div>}
            </div>
          ))}
        </div>
      )}

      <ErrorAlert message={error} />
      <SuccessAlert message={notice} />

      {editingId !== null ? (
        <div className="card">
          <h3>{editingId === "new" ? "New passage" : "Edit passage"}</h3>
          <form onSubmit={save}>
            <div className="row">
              <div style={{ flex: 3 }}>
                <label>Title</label>
                <input value={title} onChange={(e) => setTitle(e.target.value)} required />
              </div>
              <div style={{ flex: 1 }}>
                <label>Difficulty</label>
                <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
                  {DIFFICULTIES.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            </div>
            <label>Paragraph</label>
            <textarea rows={5} value={paragraph} onChange={(e) => setParagraph(e.target.value)} required />

            {qs.map((q, i) => (
              <div className="card" key={i} style={{ background: "var(--bg)" }}>
                <div className="row">
                  <div>
                    <label>Q{i + 1} code</label>
                    <input value={q.q_code} onChange={(e) => setQ(i, "q_code", e.target.value)} required />
                  </div>
                  <div>
                    <label>Answer</label>
                    <select value={q.answer} onChange={(e) => setQ(i, "answer", e.target.value)}>
                      {["A", "B", "C", "D"].map((a) => <option key={a} value={a}>{a}</option>)}
                    </select>
                  </div>
                </div>
                <label>Question text</label>
                <textarea rows={2} value={q.question_text} onChange={(e) => setQ(i, "question_text", e.target.value)} required />
                <div className="row">
                  <div><label>A</label><input value={q.opt_a} onChange={(e) => setQ(i, "opt_a", e.target.value)} required /></div>
                  <div><label>B</label><input value={q.opt_b} onChange={(e) => setQ(i, "opt_b", e.target.value)} required /></div>
                  <div><label>C</label><input value={q.opt_c} onChange={(e) => setQ(i, "opt_c", e.target.value)} required /></div>
                  <div><label>D</label><input value={q.opt_d} onChange={(e) => setQ(i, "opt_d", e.target.value)} required /></div>
                </div>
              </div>
            ))}

            <div className="actions">
              <button className="btn" type="submit">Save</button>
              <button className="btn ghost" type="button" onClick={() => setEditingId(null)}>Cancel</button>
            </div>
          </form>
        </div>
      ) : comps.length === 0 ? (
        <div className="card muted">No passages yet.</div>
      ) : (
        comps.map((c) => (
          <div className="card" key={c.id}>
            <div className="test-header">
              <h3 style={{ margin: 0 }}>
                {c.title} <span className={`badge ${DIFF_COLOR[c.difficulty] ?? "gray"}`}>{c.difficulty}</span>
              </h3>
              <div className="actions" style={{ marginTop: 0 }}>
                <button className="btn sm ghost" onClick={() => startEdit(c)}>Edit</button>
                <button className="btn sm danger" onClick={() => remove(c)}>Delete</button>
              </div>
            </div>
            <p className="muted">{c.paragraph_text.slice(0, 200)}{c.paragraph_text.length > 200 ? "…" : ""}</p>
            <p className="muted" style={{ fontSize: "0.85rem" }}>{c.questions.length} question(s)</p>
          </div>
        ))
      )}
    </div>
  );
}
