import { useEffect, useState } from "react";
import { adminProgress, errorMessage } from "../../../api/client";
import { ErrorAlert, StatusBadge } from "../../../components/common";
import type { SessionProgress } from "../../../types";

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
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
