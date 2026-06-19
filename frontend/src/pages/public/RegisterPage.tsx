import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { errorMessage, publicApi } from "../../api/client";
import { PublicLayout } from "../../components/Layout";
import { ErrorAlert, Spinner } from "../../components/common";
import type { TestOut } from "../../types";

export default function RegisterPage() {
  const { testId } = useParams();
  const [tests, setTests] = useState<TestOut[] | null>(null);
  const [form, setForm] = useState({
    test_id: testId ? Number(testId) : 0,
    first_name: "",
    last_name: "",
    nilai: "",
    email: "",
    confirm_email: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    publicApi
      .openTests()
      .then((ts) => {
        setTests(ts);
        if (!testId && ts.length) setForm((f) => ({ ...f, test_id: ts[0].id }));
      })
      .catch((e) => setError(errorMessage(e)));
  }, [testId]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: k === "test_id" ? Number(e.target.value) : e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (form.email.trim().toLowerCase() !== form.confirm_email.trim().toLowerCase()) {
      setError("Email and confirmation email do not match.");
      return;
    }
    if (!form.test_id) {
      setError("Please choose a test.");
      return;
    }
    setSubmitting(true);
    try {
      await publicApi.register(form);
      setDone(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <PublicLayout>
        <div className="card narrow center">
          <h2>Check your inbox 📧</h2>
          <p>
            Thanks, {form.first_name}! We've sent a confirmation link to <b>{form.email}</b>. Open it
            to verify your email address. After that, the administrator will review your registration.
          </p>
          <p className="muted" style={{ fontSize: "0.85rem" }}>
            (In local development without SMTP, the verification link is printed in the backend console.)
          </p>
        </div>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout>
      <div className="card narrow">
        <h1>Register for a test</h1>
        <ErrorAlert message={error} />
        {tests === null && !error ? (
          <Spinner />
        ) : (
          <form onSubmit={submit}>
            <label>Test</label>
            <select value={form.test_id} onChange={set("test_id")} required>
              <option value={0} disabled>
                Select a test…
              </option>
              {tests?.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>

            <div className="row">
              <div>
                <label>First name</label>
                <input value={form.first_name} onChange={set("first_name")} required maxLength={120} />
              </div>
              <div>
                <label>Last name</label>
                <input value={form.last_name} onChange={set("last_name")} required maxLength={120} />
              </div>
            </div>

            <label>Nilai (Class)</label>
            <input value={form.nilai} onChange={set("nilai")} required maxLength={60} placeholder="e.g. Nilai 5" />

            <label>Email address</label>
            <input type="email" value={form.email} onChange={set("email")} required />

            <label>Confirm email address</label>
            <input type="email" value={form.confirm_email} onChange={set("confirm_email")} required />

            <div className="actions">
              <button className="btn" type="submit" disabled={submitting}>
                {submitting ? "Submitting…" : "Register"}
              </button>
            </div>
          </form>
        )}
      </div>
    </PublicLayout>
  );
}
