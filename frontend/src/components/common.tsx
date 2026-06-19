import { useEffect, useState } from "react";

const STATUS_COLORS: Record<string, string> = {
  draft: "gray",
  scheduled: "blue",
  released: "green",
  closed: "gray",
  pending_email: "amber",
  email_verified: "blue",
  approved: "green",
  rejected: "red",
  not_started: "gray",
  in_progress: "amber",
  completed: "green",
  timed_out: "red",
};

export function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLORS[status] ?? "gray";
  return <span className={`badge ${color}`}>{status.replace(/_/g, " ")}</span>;
}

export function Spinner({ label = "Loading…" }: { label?: string }) {
  return <div className="spinner">{label}</div>;
}

export function ErrorAlert({ message }: { message: string | null }) {
  if (!message) return null;
  return <div className="alert error">{message}</div>;
}

export function SuccessAlert({ message }: { message: string | null }) {
  if (!message) return null;
  return <div className="alert success">{message}</div>;
}

function fmt(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Countdown driven by a server-provided seconds value. It ticks locally for
 * smooth display; the parent re-seeds `seconds` whenever it polls the server,
 * keeping it authoritative. Calls onExpire once when it crosses zero.
 */
export function Countdown({
  seconds,
  label,
  onExpire,
}: {
  seconds: number | null;
  label: string;
  onExpire?: () => void;
}) {
  const [remaining, setRemaining] = useState(seconds ?? 0);

  useEffect(() => {
    setRemaining(seconds ?? 0);
  }, [seconds]);

  useEffect(() => {
    if (seconds === null) return;
    const id = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(id);
          onExpire?.();
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seconds]);

  if (seconds === null) return null;
  const warn = remaining <= 30;
  return (
    <span>
      <span className="muted" style={{ fontSize: "0.8rem" }}>{label} </span>
      <span className={`timer ${warn ? "warn" : ""}`}>{fmt(remaining)}</span>
    </span>
  );
}
