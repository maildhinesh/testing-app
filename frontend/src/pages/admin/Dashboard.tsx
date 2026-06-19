import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { adminTests, errorMessage } from "../../api/client";
import { AdminLayout } from "../../components/Layout";
import { ErrorAlert, Spinner, StatusBadge } from "../../components/common";
import type { TestStats } from "../../types";

export default function Dashboard() {
  const [tests, setTests] = useState<TestStats[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", scheduled_date: "" });
  const [busy, setBusy] = useState(false);

  function load() {
    adminTests
      .list()
      .then(setTests)
      .catch((e) => setError(errorMessage(e)));
  }
  useEffect(load, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await adminTests.create({
        name: form.name,
        description: form.description || null,
        scheduled_date: form.scheduled_date ? new Date(form.scheduled_date).toISOString() : null,
      });
      setForm({ name: "", description: "", scheduled_date: "" });
      setShowCreate(false);
      load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const completedCount = (tests ?? []).filter((t) => t.sessions_completed > 0).length;

  return (
    <AdminLayout>
      <div className="test-header">
        <h1>Dashboard</h1>
        <button className="btn" onClick={() => setShowCreate((s) => !s)}>
          {showCreate ? "Cancel" : "+ New test"}
        </button>
      </div>

      <ErrorAlert message={error} />

      {showCreate && (
        <div className="card">
          <h3>Create a test</h3>
          <form onSubmit={create}>
            <label>Name</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            <label>Description</label>
            <textarea
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
            <label>Scheduled date (optional)</label>
            <input
              type="datetime-local"
              value={form.scheduled_date}
              onChange={(e) => setForm({ ...form, scheduled_date: e.target.value })}
            />
            <div className="actions">
              <button className="btn" type="submit" disabled={busy}>
                {busy ? "Creating…" : "Create"}
              </button>
            </div>
          </form>
        </div>
      )}

      {tests === null && !error ? (
        <Spinner />
      ) : (
        <>
          <div className="stat-grid" style={{ marginBottom: 20 }}>
            <div className="stat">
              <div className="num">{tests?.length ?? 0}</div>
              <div className="lbl">Total tests</div>
            </div>
            <div className="stat">
              <div className="num">{tests?.filter((t) => t.test.status === "released").length ?? 0}</div>
              <div className="lbl">Released</div>
            </div>
            <div className="stat">
              <div className="num">{completedCount}</div>
              <div className="lbl">With completions</div>
            </div>
            <div className="stat">
              <div className="num">{tests?.reduce((a, t) => a + t.total_registrations, 0) ?? 0}</div>
              <div className="lbl">Registrations</div>
            </div>
          </div>

          {tests && tests.length === 0 ? (
            <div className="card muted">No tests yet. Create your first one above.</div>
          ) : (
            tests?.map((t) => (
              <Link to={`/admin/tests/${t.test.id}`} className="card" key={t.test.id} style={{ display: "block", color: "inherit" }}>
                <div className="test-header">
                  <div>
                    <h3 style={{ marginBottom: 4 }}>{t.test.name}</h3>
                    <StatusBadge status={t.test.status} />
                    {t.test.scores_released && <span className="badge green" style={{ marginLeft: 6 }}>scores released</span>}
                    {t.test.scheduled_date && (
                      <span className="muted" style={{ marginLeft: 10 }}>
                        {new Date(t.test.scheduled_date).toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
                <div className="stat-grid" style={{ marginTop: 12 }}>
                  <div className="stat"><div className="num">{t.total_registrations}</div><div className="lbl">Registered</div></div>
                  <div className="stat"><div className="num">{t.awaiting_approval}</div><div className="lbl">Awaiting approval</div></div>
                  <div className="stat"><div className="num">{t.approved}</div><div className="lbl">Approved</div></div>
                  <div className="stat"><div className="num">{t.sessions_started}</div><div className="lbl">Started</div></div>
                  <div className="stat"><div className="num">{t.sessions_completed}</div><div className="lbl">Completed</div></div>
                </div>
              </Link>
            ))
          )}
        </>
      )}
    </AdminLayout>
  );
}
