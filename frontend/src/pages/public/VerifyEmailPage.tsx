import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { errorMessage, publicApi } from "../../api/client";
import { PublicLayout } from "../../components/Layout";
import { Spinner } from "../../components/common";

export default function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  const [message, setMessage] = useState("");
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return; // guard against StrictMode double-invoke
    ran.current = true;
    if (!token) {
      setState("error");
      setMessage("Missing verification token.");
      return;
    }
    publicApi
      .verifyEmail(token)
      .then((r) => {
        setState("ok");
        setMessage(r.message);
      })
      .catch((e) => {
        setState("error");
        setMessage(errorMessage(e, "Could not verify this link."));
      });
  }, [token]);

  return (
    <PublicLayout>
      <div className="card narrow center">
        {state === "loading" && <Spinner label="Verifying your email…" />}
        {state === "ok" && (
          <>
            <h2>✅ Email verified</h2>
            <p>{message}</p>
            <Link className="btn" to="/">
              Back to home
            </Link>
          </>
        )}
        {state === "error" && (
          <>
            <h2>⚠️ Verification failed</h2>
            <div className="alert error">{message}</div>
            <Link className="btn secondary" to="/">
              Back to home
            </Link>
          </>
        )}
      </div>
    </PublicLayout>
  );
}
