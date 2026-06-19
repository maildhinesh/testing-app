import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { adminTests, errorMessage } from "../../api/client";
import { AdminLayout } from "../../components/Layout";
import { ErrorAlert, Spinner, StatusBadge, SuccessAlert } from "../../components/common";
import type { TestStats } from "../../types";
import RegistrationsTab from "./tabs/RegistrationsTab";
import QuestionsTab from "./tabs/QuestionsTab";
import ComprehensionTab from "./tabs/ComprehensionTab";
import StoryPromptTab from "./tabs/StoryPromptTab";
import ProgressTab from "./tabs/ProgressTab";

const TABS = ["Registrations", "Questions (1-3)", "Comprehension (4)", "Story (5)", "Progress & Scores"] as const;
type Tab = (typeof TABS)[number];

export default function TestDetail() {
  const { testId } = useParams();
  const id = Number(testId);
  const [stats, setStats] = useState<TestStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("Registrations");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    adminTests
      .get(id)
      .then(setStats)
      .catch((e) => setError(errorMessage(e)));
  }, [id]);

  useEffect(load, [load]);

  async function release() {
    if (!confirm("Release this test to all approved registrants? They will be emailed a secure link.")) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const s = await adminTests.release(id);
      setStats(s);
      setNotice(`Test released to ${s.approved} approved registrant(s). Magic links emailed.`);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function releaseScores() {
    if (!confirm("Release scores to all registrants? They will be able to view their results.")) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const s = await adminTests.releaseScores(id);
      setStats(s);
      setNotice("Scores released. Registrants have been emailed.");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  if (!stats && !error) {
    return (
      <AdminLayout>
        <Spinner />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <ErrorAlert message={error} />
      {stats && (
        <>
          <div className="test-header">
            <div>
              <h1 style={{ marginBottom: 4 }}>{stats.test.name}</h1>
              <StatusBadge status={stats.test.status} />
              {stats.test.scores_released && <span className="badge green" style={{ marginLeft: 6 }}>scores released</span>}
            </div>
            <div className="actions" style={{ marginTop: 0 }}>
              <button className="btn" onClick={release} disabled={busy || stats.test.status === "released"}>
                {stats.test.status === "released" ? "Released" : "Release test"}
              </button>
              <button className="btn ok" onClick={releaseScores} disabled={busy || stats.test.scores_released}>
                {stats.test.scores_released ? "Scores released" : "Release scores"}
              </button>
            </div>
          </div>

          <SuccessAlert message={notice} />

          <div className="stat-grid" style={{ marginBottom: 20 }}>
            <div className="stat"><div className="num">{stats.total_registrations}</div><div className="lbl">Registered</div></div>
            <div className="stat"><div className="num">{stats.pending_email}</div><div className="lbl">Pending email</div></div>
            <div className="stat"><div className="num">{stats.awaiting_approval}</div><div className="lbl">Awaiting approval</div></div>
            <div className="stat"><div className="num">{stats.approved}</div><div className="lbl">Approved</div></div>
            <div className="stat"><div className="num">{stats.sessions_started}</div><div className="lbl">Started</div></div>
            <div className="stat"><div className="num">{stats.sessions_completed}</div><div className="lbl">Completed</div></div>
          </div>

          <div className="tabs">
            {TABS.map((t) => (
              <button key={t} className={`tab ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>
                {t}
              </button>
            ))}
          </div>

          {tab === "Registrations" && <RegistrationsTab testId={id} onChanged={load} />}
          {tab === "Questions (1-3)" && <QuestionsTab testId={id} />}
          {tab === "Comprehension (4)" && <ComprehensionTab testId={id} />}
          {tab === "Story (5)" && <StoryPromptTab testId={id} />}
          {tab === "Progress & Scores" && <ProgressTab testId={id} scoresReleased={stats.test.scores_released} />}
        </>
      )}
    </AdminLayout>
  );
}
