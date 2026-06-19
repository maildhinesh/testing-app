import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { errorMessage, session } from "../../api/client";
import { Countdown, ErrorAlert, Spinner } from "../../components/common";
import { useExamLockdown } from "../../components/useExamLockdown";
import type { ScoreBreakdown, SessionInfo, SessionState } from "../../types";

const CATEGORY_NAMES: Record<number, string> = {
  1: "Category 1 · Alphabets",
  2: "Category 2 · Grammar",
  3: "Category 3 · Translation",
  4: "Category 4 · Comprehension",
  5: "Category 5 · Story Writing",
  6: "Category 6 · Oral",
};

export default function TakeTestPage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";

  const [info, setInfo] = useState<SessionInfo | null>(null);
  const [state, setState] = useState<SessionState | null>(null);
  const [score, setScore] = useState<ScoreBreakdown | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<"loading" | "landing" | "testing" | "done">("loading");
  const [busy, setBusy] = useState(false);

  const loadInfo = useCallback(async () => {
    if (!token) {
      setError("Missing access token. Please use the secure link from your email.");
      return;
    }
    try {
      const i = await session.info(token);
      setInfo(i);
      if (i.session_status === "completed" || i.session_status === "timed_out") {
        if (i.scores_released) {
          setScore(await session.score(token));
        }
        setPhase("done");
      } else if (i.session_status === "in_progress") {
        setState(await session.state(token));
        setPhase("testing");
      } else {
        setPhase("landing");
      }
    } catch (e) {
      setError(errorMessage(e, "Could not load your test."));
    }
  }, [token]);

  useEffect(() => {
    loadInfo();
  }, [loadInfo]);

  // Anti-cheating: lock down the page while testing and record tab/window switches.
  const [tabSwitches, setTabSwitches] = useState(0);
  const onFocusLoss = useCallback(() => {
    setTabSwitches((n) => n + 1);
    if (token) session.flag(token).catch(() => {});
  }, [token]);
  useExamLockdown(phase === "testing", onFocusLoss);

  function apply(s: SessionState) {
    setState(s);
    if (s.status === "completed" || s.status === "timed_out") {
      setPhase("done");
      if (info?.scores_released || token) {
        session.score(token).then(setScore).catch(() => {});
      }
    }
  }

  async function startTest() {
    setBusy(true);
    setError(null);
    try {
      apply(await session.start(token));
      setPhase("testing");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function refresh() {
    try {
      apply(await session.state(token));
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  if (phase === "loading") return <div className="full-center"><Spinner label="Loading your test…" /></div>;

  if (error && !info) {
    return (
      <div className="container narrow" style={{ marginTop: 60 }}>
        <div className="card center"><h2>⚠️ Unable to start</h2><div className="alert error">{error}</div></div>
      </div>
    );
  }

  return (
    <div className="container" style={{ maxWidth: 800 }}>
      {phase === "landing" && info && (
        <div className="card center" style={{ marginTop: 40 }}>
          <h1>{info.test_name}</h1>
          <p>Welcome, <b>{info.first_name} {info.last_name}</b>.</p>
          {!info.test_released ? (
            <div className="alert info">The test has not been released yet. Please return when your administrator opens it.</div>
          ) : (
            <>
              <div className="alert info" style={{ textAlign: "left" }}>
                <b>Before you begin:</b>
                <ul style={{ margin: "8px 0 0", paddingLeft: 20 }}>
                  <li>The full test lasts <b>75 minutes</b> across 5 written categories.</li>
                  <li>Each category is individually timed — when a category's time ends, you move on automatically.</li>
                  <li>Categories 1–3 show one question at a time and <b>cannot be revisited</b>.</li>
                  <li>Wrong answers score −1, so skip if unsure.</li>
                  <li>The timer keeps running even if you close the page — don't refresh unnecessarily.</li>
                </ul>
              </div>
              <ErrorAlert message={error} />
              <button className="btn" style={{ fontSize: "1.1rem", padding: "12px 28px" }} onClick={startTest} disabled={busy}>
                {busy ? "Starting…" : "Start the test"}
              </button>
            </>
          )}
        </div>
      )}

      {phase === "testing" && state && (
        <>
          {tabSwitches > 0 && (
            <div className="exam-warning">
              ⚠️ Leaving the test page is recorded and visible to the administrator.
              You have switched away {tabSwitches} time{tabSwitches === 1 ? "" : "s"}.
            </div>
          )}
          <TestRunner token={token} state={state} apply={apply} refresh={refresh} setError={setError} error={error} />
        </>
      )}

      {phase === "done" && (
        <DoneScreen info={info} state={state} score={score} />
      )}
    </div>
  );
}

// --------------------------- Test runner ---------------------------
function TestRunner({
  token,
  state,
  apply,
  refresh,
  setError,
  error,
}: {
  token: string;
  state: SessionState;
  apply: (s: SessionState) => void;
  refresh: () => void;
  setError: (s: string | null) => void;
  error: string | null;
}) {
  const cat = state.current_category;

  return (
    <>
      <div className="card" style={{ position: "sticky", top: 0, zIndex: 10 }}>
        <div className="test-header" style={{ marginBottom: 0 }}>
          <h3 style={{ margin: 0 }}>{CATEGORY_NAMES[cat] ?? `Category ${cat}`}</h3>
          <div style={{ display: "flex", gap: 18 }}>
            <Countdown seconds={state.seconds_left_category} label="This section" onExpire={refresh} />
            <Countdown seconds={state.seconds_left_total} label="Total" onExpire={refresh} />
          </div>
        </div>
      </div>

      <ErrorAlert message={error} />

      {state.question && <MCQ key={state.question.assignment_id} token={token} state={state} apply={apply} setError={setError} />}
      {state.comprehension && <Comprehension token={token} state={state} apply={apply} setError={setError} />}
      {state.story && <Story token={token} state={state} apply={apply} setError={setError} />}
      {state.message && !state.question && !state.comprehension && !state.story && (
        <div className="card center"><p>{state.message}</p></div>
      )}
    </>
  );
}

// --------------------------- Categories 1-3 ---------------------------
function MCQ({ token, state, apply, setError }: RunnerProps) {
  const q = state.question!;
  const [selected, setSelected] = useState<string | null>(q.selected_option);
  const [busy, setBusy] = useState(false);

  async function submit(skip: boolean) {
    setBusy(true);
    setError(null);
    try {
      apply(await session.answer(token, q.assignment_id, skip ? null : selected));
      setSelected(null);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const opts: [string, string][] = [
    ["A", q.options.a],
    ["B", q.options.b],
    ["C", q.options.c],
    ["D", q.options.d],
  ];

  return (
    <div className="card">
      <div className="muted" style={{ fontSize: "0.85rem" }}>
        Question {q.index_in_category} of {q.total_in_category}
      </div>
      <div className="progress-bar" style={{ margin: "8px 0 18px" }}>
        <div style={{ width: `${(q.index_in_category / q.total_in_category) * 100}%` }} />
      </div>
      <h2 style={{ fontSize: "1.3rem" }}>{q.question_text}</h2>
      {opts.map(([key, text]) => (
        <div
          key={key}
          className={`option ${selected === key ? "selected" : ""}`}
          onClick={() => !busy && setSelected(key)}
        >
          <span className="key">{key}</span>
          <span>{text}</span>
        </div>
      ))}
      <div className="actions">
        <button className="btn" disabled={busy || !selected} onClick={() => submit(false)}>
          Submit &amp; next
        </button>
        <button className="btn ghost" disabled={busy} onClick={() => submit(true)}>
          Skip
        </button>
      </div>
    </div>
  );
}

// --------------------------- Category 4 ---------------------------
function Comprehension({ token, state, apply, setError }: RunnerProps) {
  const comp = state.comprehension!;
  const [busy, setBusy] = useState(false);

  async function choose(assignmentId: number, option: string) {
    setError(null);
    try {
      apply(await session.answer(token, assignmentId, option));
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  async function finish() {
    if (!confirm("Finish the comprehension section? You won't be able to change these answers.")) return;
    setBusy(true);
    setError(null);
    try {
      apply(await session.finishComprehension(token));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <h2>{comp.title}</h2>
      <div className="card" style={{ background: "var(--bg)", whiteSpace: "pre-wrap" }}>{comp.paragraph_text}</div>

      {comp.questions.map((q, i) => (
        <div key={q.assignment_id} style={{ marginTop: 20 }}>
          <b>{i + 1}. {q.question_text}</b>
          {([["A", q.options.a], ["B", q.options.b], ["C", q.options.c], ["D", q.options.d]] as [string, string][]).map(
            ([key, text]) => (
              <div
                key={key}
                className={`option ${q.selected_option === key ? "selected" : ""}`}
                onClick={() => choose(q.assignment_id, key)}
              >
                <span className="key">{key}</span>
                <span>{text}</span>
              </div>
            )
          )}
        </div>
      ))}

      <div className="actions">
        <button className="btn" onClick={finish} disabled={busy}>Finish section</button>
      </div>
    </div>
  );
}

// --------------------------- Category 5 ---------------------------
function Story({ token, state, apply, setError }: RunnerProps) {
  const story = state.story!;
  const [text, setText] = useState(story.answer_text);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const savedTimer = useRef<number | null>(null);

  async function save(final: boolean) {
    if (final && !confirm("Submit your story and finish the written test? You can't edit it afterwards.")) return;
    setBusy(true);
    setError(null);
    try {
      const s = await session.story(token, story.prompt_id, text, final);
      apply(s);
      if (!final) {
        setSaved("Draft saved ✓");
        if (savedTimer.current) window.clearTimeout(savedTimer.current);
        savedTimer.current = window.setTimeout(() => setSaved(null), 2500);
      }
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <h2>Story Writing</h2>
      <div className="card" style={{ background: "var(--bg)", whiteSpace: "pre-wrap" }}>{story.prompt_text}</div>
      <label>Your story</label>
      <textarea rows={14} value={text} onChange={(e) => setText(e.target.value)} placeholder="Write your story here…" />
      <div className="muted" style={{ fontSize: "0.8rem", marginTop: 4 }}>{text.trim().split(/\s+/).filter(Boolean).length} words</div>
      <div className="actions">
        <button className="btn secondary" onClick={() => save(false)} disabled={busy}>Save draft</button>
        <button className="btn" onClick={() => save(true)} disabled={busy}>Submit &amp; finish</button>
        {saved && <span className="badge green" style={{ alignSelf: "center" }}>{saved}</span>}
      </div>
    </div>
  );
}

// --------------------------- Done / score ---------------------------
function DoneScreen({
  info,
  state,
  score,
}: {
  info: SessionInfo | null;
  state: SessionState | null;
  score: ScoreBreakdown | null;
}) {
  const timedOut = state?.status === "timed_out" || info?.session_status === "timed_out";
  return (
    <div className="card center" style={{ marginTop: 40 }}>
      <h1>{timedOut ? "⏱️ Time's up" : "✅ Written test complete"}</h1>
      <p>
        {state?.message ??
          "Your written test has ended. Please proceed to the oral part (Category 6) with the test administrator."}
      </p>

      {score && score.released ? (
        <div style={{ marginTop: 24, textAlign: "left" }}>
          <h2 className="center">Your results</h2>
          <table>
            <tbody>
              {Object.entries(score.category_scores).map(([k, v]) => (
                <tr key={k}><td>{k}</td><td style={{ textAlign: "right" }}><b>{v}</b></td></tr>
              ))}
              <tr><td>Story (Category 5)</td><td style={{ textAlign: "right" }}>{score.cat5_score ?? "—"}</td></tr>
              <tr><td>Oral (Category 6)</td><td style={{ textAlign: "right" }}>{score.cat6_score ?? "—"}</td></tr>
              <tr><td><b>Auto-scored total</b></td><td style={{ textAlign: "right" }}><b>{score.auto_total}</b></td></tr>
              <tr style={{ fontSize: "1.1rem" }}>
                <td><b>Grand total</b></td>
                <td style={{ textAlign: "right" }}><b>{score.grand_total ?? "—"}</b></td>
              </tr>
            </tbody>
          </table>
          {score.final_difficulty && (
            <p className="center muted">Final difficulty reached: <span className="badge blue">{score.final_difficulty}</span></p>
          )}
        </div>
      ) : (
        <div className="alert info" style={{ marginTop: 20 }}>
          Your scores haven't been released yet. You'll be emailed your secure link again when results are available.
        </div>
      )}
    </div>
  );
}

interface RunnerProps {
  token: string;
  state: SessionState;
  apply: (s: SessionState) => void;
  setError: (s: string | null) => void;
}
