import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { errorMessage, publicApi } from "../../api/client";
import { PublicLayout } from "../../components/Layout";
import { ErrorAlert, Spinner, StatusBadge } from "../../components/common";
import type { TestOut } from "../../types";

export default function HomePage() {
  const [tests, setTests] = useState<TestOut[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    publicApi
      .openTests()
      .then(setTests)
      .catch((e) => setError(errorMessage(e)));
  }, []);

  return (
    <PublicLayout>
      <div className="card">
        <h1>Welcome to the Tamil Knowledge Test</h1>
        <p className="muted">
          Register below for an upcoming test. You'll receive an email to confirm your address, and
          once the administrator approves you, a secure link to take the test on the testing day.
        </p>
      </div>

      <h2>Open for registration</h2>
      <ErrorAlert message={error} />
      {tests === null && !error ? (
        <Spinner />
      ) : tests && tests.length === 0 ? (
        <div className="card muted">No tests are open for registration right now.</div>
      ) : (
        tests?.map((t) => (
          <div className="card" key={t.id}>
            <div className="test-header">
              <div>
                <h3 style={{ marginBottom: 4 }}>{t.name}</h3>
                <StatusBadge status={t.status} />
                {t.scheduled_date && (
                  <span className="muted" style={{ marginLeft: 10 }}>
                    Scheduled: {new Date(t.scheduled_date).toLocaleString()}
                  </span>
                )}
              </div>
              <Link className="btn" to={`/register/${t.id}`}>
                Register
              </Link>
            </div>
            {t.description && <p className="muted">{t.description}</p>}
          </div>
        ))
      )}
    </PublicLayout>
  );
}
