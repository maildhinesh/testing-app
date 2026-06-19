import { Link, useNavigate } from "react-router-dom";
import { adminToken } from "../api/client";

export function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="topbar">
        <Link to="/" className="brand">தமிழ் · Tamil Knowledge Test</Link>
        <nav>
          <Link to="/">Home</Link>
          <Link to="/admin/login">Admin</Link>
        </nav>
      </header>
      <main className="container">{children}</main>
    </>
  );
}

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const name = adminToken.name();
  return (
    <>
      <header className="topbar">
        <Link to="/admin" className="brand">Tamil Test · Admin</Link>
        <nav>
          <Link to="/admin">Dashboard</Link>
          <span style={{ marginLeft: 18, opacity: 0.9 }}>{name}</span>
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              adminToken.clear();
              navigate("/admin/login");
            }}
          >
            Log out
          </a>
        </nav>
      </header>
      <main className="container">{children}</main>
    </>
  );
}
