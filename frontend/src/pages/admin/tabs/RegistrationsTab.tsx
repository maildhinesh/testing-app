import { useEffect, useState } from "react";
import { adminRegistrations, errorMessage } from "../../../api/client";
import { ErrorAlert, StatusBadge } from "../../../components/common";
import type { RegistrationOut } from "../../../types";

const FILTERS = ["all", "pending_email", "email_verified", "approved", "rejected"];

export default function RegistrationsTab({ testId, onChanged }: { testId: number; onChanged: () => void }) {
  const [regs, setRegs] = useState<RegistrationOut[]>([]);
  const [filter, setFilter] = useState("all");
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ first_name: "", last_name: "", nilai: "", email: "" });
  const [busy, setBusy] = useState(false);

  function load() {
    adminRegistrations
      .list(testId, filter === "all" ? undefined : filter)
      .then(setRegs)
      .catch((e) => setError(errorMessage(e)));
  }
  useEffect(load, [testId, filter]);

  async function act(fn: () => Promise<unknown>) {
    setError(null);
    try {
      await fn();
      load();
      onChanged();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  async function addUser(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await adminRegistrations.manualRegister(testId, form);
      setForm({ first_name: "", last_name: "", nilai: "", email: "" });
      setShowAdd(false);
      load();
      onChanged();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="test-header">
        <div>
          {FILTERS.map((f) => (
            <button
              key={f}
              className={`btn sm ${filter === f ? "" : "ghost"}`}
              style={{ marginRight: 6 }}
              onClick={() => setFilter(f)}
            >
              {f.replace(/_/g, " ")}
            </button>
          ))}
        </div>
        <button className="btn" onClick={() => setShowAdd((s) => !s)}>
          {showAdd ? "Cancel" : "+ Manually register"}
        </button>
      </div>

      <ErrorAlert message={error} />

      {showAdd && (
        <div className="card">
          <h3>Manually register a user</h3>
          <p className="muted" style={{ fontSize: "0.85rem" }}>
            Admin-registered users skip email verification and are approved immediately.
          </p>
          <form onSubmit={addUser}>
            <div className="row">
              <div>
                <label>First name</label>
                <input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} required />
              </div>
              <div>
                <label>Last name</label>
                <input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} required />
              </div>
            </div>
            <div className="row">
              <div>
                <label>Nilai</label>
                <input value={form.nilai} onChange={(e) => setForm({ ...form, nilai: e.target.value })} required />
              </div>
              <div>
                <label>Email</label>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
              </div>
            </div>
            <div className="actions">
              <button className="btn" type="submit" disabled={busy}>
                {busy ? "Adding…" : "Add"}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        {regs.length === 0 ? (
          <p className="muted">No registrations{filter !== "all" ? ` with status "${filter.replace(/_/g, " ")}"` : ""}.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Nilai</th>
                <th>Email</th>
                <th>Status</th>
                <th>Registered</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {regs.map((r) => (
                <tr key={r.id}>
                  <td>{r.first_name} {r.last_name}</td>
                  <td>{r.nilai}</td>
                  <td>{r.email}</td>
                  <td><StatusBadge status={r.status} /></td>
                  <td className="muted">{new Date(r.created_at).toLocaleDateString()}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {r.status !== "approved" && r.status !== "pending_email" && (
                      <button className="btn sm ok" style={{ marginRight: 6 }} onClick={() => act(() => adminRegistrations.approve(r.id))}>
                        Approve
                      </button>
                    )}
                    {r.status !== "rejected" && (
                      <button className="btn sm danger" onClick={() => act(() => adminRegistrations.reject(r.id))}>
                        Reject
                      </button>
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
