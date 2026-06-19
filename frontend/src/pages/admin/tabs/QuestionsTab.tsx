import { useEffect, useRef, useState } from "react";
import { adminQuestions, errorMessage } from "../../../api/client";
import { ErrorAlert, SuccessAlert } from "../../../components/common";
import type { QuestionIn, QuestionOut } from "../../../types";

const CATEGORIES = [
  { n: 1, label: "Category 1 — Alphabets" },
  { n: 2, label: "Category 2 — Grammar" },
  { n: 3, label: "Category 3 — Translation" },
];

const blank: QuestionIn = {
  q_code: "",
  q_category: 1,
  q_difficulty: "easy",
  question_text: "",
  opt_a: "",
  opt_b: "",
  opt_c: "",
  opt_d: "",
  answer: "A",
};

export default function QuestionsTab({ testId }: { testId: number }) {
  const [category, setCategory] = useState(1);
  const [questions, setQuestions] = useState<QuestionOut[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState<QuestionOut | null>(null);
  const [form, setForm] = useState<QuestionIn>({ ...blank });
  const [showForm, setShowForm] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function load() {
    adminQuestions
      .list(testId, category)
      .then(setQuestions)
      .catch((e) => setError(errorMessage(e)));
  }
  useEffect(load, [testId, category]);

  function startNew() {
    setEditing(null);
    setForm({ ...blank, q_category: category });
    setShowForm(true);
  }
  function startEdit(q: QuestionOut) {
    setEditing(q);
    setForm({
      q_code: q.q_code,
      q_category: q.q_category,
      q_difficulty: q.q_difficulty,
      question_text: q.question_text,
      opt_a: q.opt_a,
      opt_b: q.opt_b,
      opt_c: q.opt_c,
      opt_d: q.opt_d,
      answer: q.answer,
    });
    setShowForm(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    try {
      if (editing) {
        await adminQuestions.update(testId, editing.id, form);
        setNotice("Question updated.");
      } else {
        await adminQuestions.create(testId, form);
        setNotice("Question created.");
      }
      setShowForm(false);
      setCategory(form.q_category);
      load();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function remove(q: QuestionOut) {
    if (!confirm(`Delete question ${q.q_code}?`)) return;
    setError(null);
    try {
      await adminQuestions.remove(testId, q.id);
      load();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setNotice(null);
    try {
      const res = await adminQuestions.bulkUpload(testId, file);
      setNotice(
        `Bulk upload: ${res.inserted} inserted, ${res.updated} updated` +
          (res.errors.length ? `. ${res.errors.length} row error(s): ${res.errors.slice(0, 3).join("; ")}${res.errors.length > 3 ? "…" : ""}` : ".")
      );
      load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const set = (k: keyof QuestionIn) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: k === "q_category" ? Number(e.target.value) : e.target.value }));

  return (
    <div>
      <div className="test-header">
        <div>
          {CATEGORIES.map((c) => (
            <button key={c.n} className={`btn sm ${category === c.n ? "" : "ghost"}`} style={{ marginRight: 6 }} onClick={() => setCategory(c.n)}>
              {c.label}
            </button>
          ))}
        </div>
        <div className="actions" style={{ marginTop: 0 }}>
          <button className="btn secondary" onClick={() => fileRef.current?.click()}>Bulk upload CSV</button>
          <input ref={fileRef} type="file" accept=".csv" hidden onChange={upload} />
          <button className="btn" onClick={startNew}>+ Add question</button>
        </div>
      </div>

      <p className="muted" style={{ fontSize: "0.83rem" }}>
        CSV columns: q_code, q_category, q_difficulty, question_text, opt_a, opt_b, opt_c, opt_d, answer. Upserts by q_code.
      </p>

      <ErrorAlert message={error} />
      <SuccessAlert message={notice} />

      {showForm && (
        <div className="card">
          <h3>{editing ? `Edit ${editing.q_code}` : "New question"}</h3>
          <form onSubmit={save}>
            <div className="row">
              <div>
                <label>Question code</label>
                <input value={form.q_code} onChange={set("q_code")} required disabled={!!editing} />
              </div>
              <div>
                <label>Category</label>
                <select value={form.q_category} onChange={set("q_category")}>
                  {CATEGORIES.map((c) => <option key={c.n} value={c.n}>{c.n}</option>)}
                </select>
              </div>
              <div>
                <label>Difficulty</label>
                <select value={form.q_difficulty} onChange={set("q_difficulty")}>
                  <option value="easy">easy</option>
                  <option value="moderate">moderate</option>
                  {form.q_category !== 1 && <option value="hard">hard</option>}
                </select>
              </div>
            </div>
            <label>Question text</label>
            <textarea rows={2} value={form.question_text} onChange={set("question_text")} required />
            <div className="row">
              <div><label>Option A</label><input value={form.opt_a} onChange={set("opt_a")} required /></div>
              <div><label>Option B</label><input value={form.opt_b} onChange={set("opt_b")} required /></div>
            </div>
            <div className="row">
              <div><label>Option C</label><input value={form.opt_c} onChange={set("opt_c")} required /></div>
              <div><label>Option D</label><input value={form.opt_d} onChange={set("opt_d")} required /></div>
            </div>
            <label>Correct answer</label>
            <select value={form.answer} onChange={set("answer")} style={{ maxWidth: 120 }}>
              {["A", "B", "C", "D"].map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
            <div className="actions">
              <button className="btn" type="submit">{editing ? "Save" : "Create"}</button>
              <button className="btn ghost" type="button" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        {questions.length === 0 ? (
          <p className="muted">No questions in this category yet.</p>
        ) : (
          <table>
            <thead>
              <tr><th>Code</th><th>Difficulty</th><th>Question</th><th>Answer</th><th></th></tr>
            </thead>
            <tbody>
              {questions.map((q) => (
                <tr key={q.id}>
                  <td>{q.q_code}</td>
                  <td><span className="badge gray">{q.q_difficulty}</span></td>
                  <td>{q.question_text}</td>
                  <td><b>{q.answer}</b></td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <button className="btn sm ghost" style={{ marginRight: 6 }} onClick={() => startEdit(q)}>Edit</button>
                    <button className="btn sm danger" onClick={() => remove(q)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
