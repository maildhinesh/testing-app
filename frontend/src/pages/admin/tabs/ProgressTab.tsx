import { useEffect, useState } from "react";
import { adminProgress, errorMessage } from "../../../api/client";
import { ErrorAlert, Spinner, StatusBadge } from "../../../components/common";
import type { ResponseDetail, SessionProgress, SessionResponses } from "../../../types";

const CATEGORY_LABELS: Record<number, string> = {
  1: "Category 1 — Alphabets",
  2: "Category 2 — Grammar",
  3: "Category 3 — Translation",
  4: "Category 4 — Comprehension",
};

function AnswerRow({ r }: { r: ResponseDetail }) {
  const opts: [string, string][] = [
    ["A", r.options.a],
    ["B", r.options.b],
    ["C", r.options.c],
    ["D", r.options.d],
  ];
  return (
    <div className="answer-item">
      <div className="answer-tags">
        <span className="badge gray">{r.q_code}</span>
        <span className="badge blue">{r.difficulty}</span>
        {!r.answered ? (
          <span className="badge amber">skipped</span>
        ) : r.is_correct ? (
          <span className="badge green">correct</span>
        ) : (
          <span className="badge red">wrong</span>
        )}
        <span>{r.points_awarded >= 0 ? `+${r.points_awarded}` : r.points_awarded} pts</span>
      </div>
      <div className="q-text">{r.question_text}</div>
      {opts.map(([key, text]) => {
        const isCorrect = key === r.correct_answer;
        const isChosen = key === r.selected_option;
        const cls = isCorrect ? "correct" : isChosen ? "chosen-wrong" : "";
        return (
          <div className={`answer-opt ${cls}`} key={key}>
            <span className="key">{key}</span>
            <span>{text}</span>
            <span style={{ marginLeft: "auto" }}>
              {isCorrect && "✓ answer"}
              {isChosen && !isCorrect && "● chose"}
              {isChosen && isCorrect && " (chose)"}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function ResponsesModal({ sessionId, onClose }: { sessionId: number; onClose: () => void }) {
  const [data, setData] = useState<SessionResponses | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminProgress
      .responses(sessionId)
      .then(setData)
      .catch((e) => setError(errorMessage(e)));
  }, [sessionId]);

  const byCategory: Record<number, ResponseDetail[]> = {};
  for (const r of data?.responses ?? []) {
    (byCategory[r.category] ??= []).push(r);
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 style={{ margin: 0 }}>
            {data ? `${data.first_name} ${data.last_name}` : "Responses"}
            {data && <span className="muted" style={{ fontWeight: 400 }}> — {data.nilai}</span>}
          </h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        <ErrorAlert message={error} />
        {!data && !error ? (
          <Spinner />
        ) : data ? (
          <div>
            {data.responses.length === 0 && !data.story ? (
              <p className="muted">This student has not answered anything yet.</p>
            ) : null}
            {[1, 2, 3, 4].map((cat) =>
              byCategory[cat]?.length ? (
                <div key={cat} style={{ marginBottom: 18 }}>
                  <h3>{CATEGORY_LABELS[cat]}</h3>
                  {byCategory[cat].map((r) => (
                    <AnswerRow key={r.assignment_id} r={r} />
                  ))}
                </div>
              ) : null
            )}
            {data.story && (
              <div style={{ marginBottom: 8 }}>
                <h3>Category 5 — Story</h3>
                <div className="answer-item">
                  <div className="muted" style={{ fontSize: "0.85rem", marginBottom: 8 }}>
                    Prompt: {data.story.prompt_text}
                  </div>
                  {data.story.answer_text ? (
                    <div style={{ whiteSpace: "pre-wrap" }}>{data.story.answer_text}</div>
                  ) : (
                    <span className="muted">No story submitted.</span>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ScoreCell({
  session_id,
  category,
  value,
  onSaved,
}: {
  session_id: number | null;
  category: number;
  value: number | null;
  onSaved: (p: SessionProgress) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value ?? 0);
  const [err, setErr] = useState<string | null>(null);

  if (session_id === null) return <span className="muted">—</span>;

  async function save() {
    setErr(null);
    try {
      const p = await adminProgress.manualScore(session_id!, category, Number(val));
      onSaved(p);
      setEditing(false);
    } catch (e) {
      setErr(errorMessage(e));
    }
  }

  if (!editing) {
    return (
      <span>
        {value ?? <span className="muted">—</span>}{" "}
        <button className="btn sm ghost" onClick={() => { setVal(value ?? 0); setEditing(true); }}>
          {value === null ? "Set" : "Edit"}
        </button>
        {err && <div className="alert error" style={{ fontSize: "0.8rem" }}>{err}</div>}
      </span>
    );
  }
  return (
    <span style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
      <input type="number" value={val} onChange={(e) => setVal(Number(e.target.value))} style={{ width: 70 }} />
      <button className="btn sm ok" onClick={save}>✓</button>
      <button className="btn sm ghost" onClick={() => setEditing(false)}>✕</button>
    </span>
  );
}

export default function ProgressTab({ testId, scoresReleased }: { testId: number; scoresReleased: boolean }) {
  const [rows, setRows] = useState<SessionProgress[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [viewing, setViewing] = useState<number | null>(null);

  function load() {
    adminProgress
      .list(testId)
      .then(setRows)
      .catch((e) => setError(errorMessage(e)));
  }
  useEffect(load, [testId]);

  function patchRow(p: SessionProgress) {
    setRows((rs) => rs.map((r) => (r.registration_id === p.registration_id ? p : r)));
  }

  return (
    <div>
      <div className="test-header">
        <p className="muted" style={{ margin: 0 }}>
          Current/final difficulty helps you set Category 6 (oral) questions at each student's level.
          {scoresReleased && " Scores have been released to students."}
        </p>
        <button className="btn secondary" onClick={load}>Refresh</button>
      </div>

      <ErrorAlert message={error} />

      <div className="card">
        {rows.length === 0 ? (
          <p className="muted">No registrations yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Nilai</th>
                <th>Status</th>
                <th>Cat</th>
                <th>Difficulty</th>
                <th>Final diff.</th>
                <th>Auto</th>
                <th>Cat 5 (story)</th>
                <th>Cat 6 (oral)</th>
                <th>Total</th>
                <th>Tab switches</th>
                <th>Answers</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.registration_id}>
                  <td>{r.first_name} {r.last_name}</td>
                  <td>{r.nilai}</td>
                  <td><StatusBadge status={r.status} /></td>
                  <td>{r.current_category ?? "—"}</td>
                  <td>{r.current_difficulty ? <span className="badge gray">{r.current_difficulty}</span> : "—"}</td>
                  <td>{r.final_difficulty ? <span className="badge blue">{r.final_difficulty}</span> : "—"}</td>
                  <td><b>{r.auto_score}</b></td>
                  <td><ScoreCell session_id={r.session_id} category={5} value={r.cat5_score} onSaved={patchRow} /></td>
                  <td><ScoreCell session_id={r.session_id} category={6} value={r.cat6_score} onSaved={patchRow} /></td>
                  <td><b>{r.total_score ?? "—"}</b></td>
                  <td>
                    {r.focus_loss_count > 0 ? (
                      <span className="badge red">{r.focus_loss_count}</span>
                    ) : (
                      <span className="muted">0</span>
                    )}
                  </td>
                  <td>
                    {r.session_id !== null ? (
                      <button className="btn sm ghost" onClick={() => setViewing(r.session_id)}>
                        View
                      </button>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {viewing !== null && <ResponsesModal sessionId={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}
