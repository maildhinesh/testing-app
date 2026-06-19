import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { adminAuth, adminToken, errorMessage } from "../../api/client";
import { PublicLayout } from "../../components/Layout";
import { ErrorAlert } from "../../components/common";

export default function AdminLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const r = await adminAuth.login(email, password);
      adminToken.set(r.access_token, r.name);
      navigate("/admin");
    } catch (err) {
      setError(errorMessage(err, "Login failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <PublicLayout>
      <div className="card narrow" style={{ marginTop: 40 }}>
        <h1>Admin sign in</h1>
        <ErrorAlert message={error} />
        <form onSubmit={submit}>
          <label>Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
          <label>Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <div className="actions">
            <button className="btn" type="submit" disabled={busy}>
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </div>
        </form>
      </div>
    </PublicLayout>
  );
}
